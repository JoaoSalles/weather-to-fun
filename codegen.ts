import type { CodegenConfig } from '@graphql-codegen/cli';
import { typeDefs } from './apps/weather-bff/src/graphql/schema';

const config: CodegenConfig = {
  schema: typeDefs,
  documents: [
    'apps/weather-app/app/**/*.{ts,tsx}',
    '!apps/weather-app/app/graphql/generated/**',
  ],
  ignoreNoDocuments: true,
  generates: {
    'apps/weather-app/app/graphql/generated/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: false,
      },
    },
  },
};

export default config;
