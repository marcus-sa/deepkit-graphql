import { GraphQLSchema } from 'graphql';

import { ApolloDriver } from './apollo-driver';

export class ApolloFederationDriver extends ApolloDriver {
  override async start(schema: GraphQLSchema): Promise<void> {
    // if (!(source instanceof GraphQLSchema) && !isDocumentNode(source)) {
    //   throw new Error('Only GraphQLSchema and DocumentNode is supported as TypeSource for ApolloFederationDriver');
    // }
    //
    // const { printSubgraphSchema, buildSubgraphSchema } = await import('@apollo/subgraph');
    //
    // const schema = source instanceof GraphQLSchema
    //   ? printSubgraphSchema(source)
    //   : buildSubgraphSchema(source);

    return super.start(schema);
  }
}
