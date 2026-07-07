import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './graphql/schema';
import { resolvers, type GraphQLContext } from './graphql/resolvers';
import { buildContext } from './context';
import { config } from './config';

async function main(): Promise<void> {
  const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
  const { url } = await startStandaloneServer(server, {
    context: async () => buildContext(),
    listen: { port: config.port },
  });
  console.log(`weather-bff ready at ${url}`);
}

main().catch((error) => {
  console.error('Failed to start weather-bff', error);
  process.exit(1);
});
