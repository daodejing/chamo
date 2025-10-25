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
  // Source: Backend auto-generated GraphQL schema
  schema: './apps/backend/src/schema.gql',

  // Documents: Frontend GraphQL operations (queries, mutations, subscriptions)
  documents: ['src/lib/graphql/**/*.ts'],

  // Output configuration
  generates: {
    // Generate TypeScript types for all operations
    './src/lib/graphql/generated/graphql.ts': {
      plugins: [
        'typescript',                    // Base TypeScript types
        'typescript-operations',         // Types for queries/mutations
        'typed-document-node',          // Typed DocumentNode for Apollo Client
      ],
      config: {
        // Type safety options
        avoidOptionals: false,           // Use optional properties (field?: type)
        skipTypename: false,             // Include __typename in types
        enumsAsTypes: true,              // Generate enums as union types

        // Naming conventions
        namingConvention: {
          typeNames: 'pascal-case#pascalCase',
          enumValues: 'upper-case#upperCase',
        },

        // Scalars mapping
        scalars: {
          DateTime: 'string',            // Map GraphQL DateTime to TypeScript string
          JSON: 'Record<string, any>',   // Map GraphQL JSON to TypeScript object
        },

        // Documentation
        addDocBlocks: true,              // Include GraphQL doc comments
      },
    },
  },

  // Hooks
  hooks: {
    afterAllFileWrite: ['prettier --write'], // Auto-format generated files
  },

  // Error handling
  errorsOnly: false,
  verbose: true,
};

export default config;
