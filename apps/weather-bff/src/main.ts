import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { NoopCache, type Cache } from '@collinson/weather-domain';
import { typeDefs } from './graphql/schema';
import { resolvers, type GraphQLContext } from './graphql/resolvers';
import { depthLimit } from './graphql/depth-limit';
import { RedisCache } from './cache/redis-cache';
import { getRedisConnection } from './cache/redis-client';
import { composeServices } from './composition';
import { config, isProduction } from './config';

async function main(): Promise<void> {
  // Select the cache backend and its lifecycle. Without Redis the instance uses
  // an in-memory no-op cache and is always ready with nothing to clean up.
  let cache: Cache = new NoopCache();
  let checkReadiness = async (): Promise<boolean> => true;
  let shutdown = async (): Promise<void> => {
    /* nothing to clean up when Redis is disabled */
  };

  if (config.redisUrl) {
    const redis = await getRedisConnection(config.redisUrl);
    cache = new RedisCache(redis.client);
    checkReadiness = redis.checkReadiness;
    shutdown = redis.shutdown;
  }

  const { weatherService } = composeServices(config, cache);

  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    // Disable schema introspection in production to reduce attack surface.
    introspection: !isProduction(config),
    // Reject abusively deep queries before they execute.
    validationRules: [depthLimit(config.maxQueryDepth)],
    // Built-in guard against selection-set amplification (aliased fan-out).
    maxRecursiveSelections: true,
    // Gracefully drain in-flight requests on shutdown.
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });
  await server.start();

  const corsOrigins =
    config.corsOrigins === '*' ? true : config.corsOrigins.split(',').map((o) => o.trim());

  // Liveness: process is up. Orchestrator restarts the pod if this fails.
  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Readiness: instance can serve (e.g. Redis reachable). Load balancer stops
  // routing traffic here until it recovers, without killing the process.
  app.get('/readyz', async (_req, res) => {
    const ready = await checkReadiness();
    res.status(ready ? 200 : 503).json({ ready });
  });

  app.use(
    '/graphql',
    cors({ origin: corsOrigins }),
    express.json({ limit: config.bodyLimit }),
    expressMiddleware(server, { context: async () => ({ weatherService }) }),
  );

  await new Promise<void>((resolve) => httpServer.listen({ port: config.port }, resolve));
  console.log(`weather-bff ready at http://localhost:${config.port}/graphql`);

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      // Drain plugin closes the HTTP server; then release external resources.
      void server
        .stop()
        .then(shutdown)
        .finally(() => process.exit(0));
    });
  }
}

main().catch((error) => {
  console.error('Failed to start weather-bff', error);
  process.exit(1);
});
