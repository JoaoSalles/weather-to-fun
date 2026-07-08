import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './graphql/schema';
import { resolvers, type GraphQLContext } from './graphql/resolvers';
import { composeServices } from './composition';
import { config } from './config';

async function main(): Promise<void> {
  const { service, shutdown } = await composeServices(config);
  const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
  const { url } = await startStandaloneServer(server, {
    context: async () => ({ service }),
    listen: { port: config.port },
  });
  console.log(`weather-bff ready at ${url}`);

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      void shutdown().finally(() => process.exit(0));
    });
  }
}

main().catch((error) => {
  console.error('Failed to start weather-bff', error);
  process.exit(1);
});
