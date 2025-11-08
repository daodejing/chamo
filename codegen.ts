import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * GraphQL Code Generator Configuration
 *
 * Generates TypeScript types from the NestJS backend GraphQL schema.
 *
 * Usage:
 *   pnpm codegen        - Generate types once
 *   pnpm codegen:watch  - Watch for schema changes and regenerate
 */
const config: CodegenConfig = {
  overwrite: true,
  // Source: Backend auto-generated GraphQL schema
  schema: './apps/backend/src/schema.gql',

  // Documents: Frontend GraphQL operations (queries, mutations, subscriptions)
  documents: ['src/lib/graphql/**/*.ts'],

  generates: {
    './src/lib/graphql/generated/': {
      preset: 'client',
      config: {
        useTypeImports: true,
        scalars: {
          DateTime: 'string',
          JSON: 'Record<string, unknown>',
        },
      },
    },
  },

  // Error handling
  errorsOnly: false,
  verbose: true,
};

export default config;
