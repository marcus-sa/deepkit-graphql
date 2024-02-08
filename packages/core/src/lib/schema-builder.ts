import { ReceiveType, resolveReceiveType, Type } from '@deepkit/type';
import { ClassType } from '@deepkit/core';
import { mergeSchemas } from '@graphql-tools/schema';
import {
  GraphQLFieldConfigMap,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql';

import { Resolvers } from './resolvers';
import { TypesBuilder } from './types-builder';
import { gqlClassDecorator } from './decorators';
import { GraphQLContext } from './types';
import { buildSubgraphSchema, printSubgraphSchema } from '@apollo/subgraph';

export interface SchemaBuilderOptions {
  readonly inputTypes?: readonly Type[];
  readonly outputTypes?: readonly Type[];
  readonly schemas?: readonly GraphQLSchema[];
}

export function buildSchema(
  resolvers: Resolvers,
  options?: SchemaBuilderOptions,
): GraphQLSchema {
  return new SchemaBuilder(resolvers, options).build();
}

export class SchemaBuilder {
  private readonly inputTypes = new Set<Type>(this.options?.inputTypes);

  private readonly outputTypes = new Set<Type>(this.options?.outputTypes);

  private readonly typesBuilder = new TypesBuilder(this.resolvers);

  constructor(
    private readonly resolvers: Resolvers,
    private readonly options?: SchemaBuilderOptions,
  ) {}

  private buildInputTypes(): readonly GraphQLNamedType[] {
    return [...this.inputTypes].map(type =>
      this.typesBuilder.createNamedInputType(type),
    );
  }

  private buildOutputTypes(): readonly GraphQLNamedType[] {
    return [...this.outputTypes].map(type =>
      this.typesBuilder.createNamedOutputType(type),
    );
  }

  generateMutationResolverFields(): GraphQLFieldConfigMap<
    unknown,
    GraphQLContext
  > {
    return [...this.resolvers].reduce<
      GraphQLFieldConfigMap<unknown, GraphQLContext>
    >(
      (fields, resolver) => ({
        // TODO: validate that fields don't override each other
        ...fields,
        ...this.typesBuilder.generateMutationResolverFields(resolver),
      }),
      {},
    );
  }

  generateSubscriptionResolverFields(): GraphQLFieldConfigMap<
    unknown,
    GraphQLContext
  > {
    return [...this.resolvers].reduce<
      GraphQLFieldConfigMap<unknown, GraphQLContext>
    >(
      (fields, resolver) => ({
        // TODO: validate that fields don't override each other
        ...fields,
        ...this.typesBuilder.generateSubscriptionResolverFields(resolver),
      }),
      {},
    );
  }

  generateQueryResolverFields(): GraphQLFieldConfigMap<
    unknown,
    GraphQLContext
  > {
    return [...this.resolvers].reduce<
      GraphQLFieldConfigMap<unknown, GraphQLContext>
    >(
      (fields, resolver) => ({
        // TODO: validate that fields don't override each other
        ...fields,
        ...this.typesBuilder.generateQueryResolverFields(resolver),
      }),
      {},
    );
  }

  hasSubscriptionResolvers(classType: ClassType): boolean {
    const resolver = gqlClassDecorator._fetch(classType);
    return !!resolver?.subscriptions.size;
  }

  hasQueryResolvers(classType: ClassType): boolean {
    const resolver = gqlClassDecorator._fetch(classType);
    return !!resolver?.queries.size;
  }

  hasMutationResolvers(classType: ClassType): boolean {
    const resolver = gqlClassDecorator._fetch(classType);
    return !!resolver?.mutations.size;
  }

  hasFieldResolvers(classType: ClassType): boolean {
    const resolver = gqlClassDecorator._fetch(classType);
    return !!resolver?.resolveFields.size;
  }

  private buildRootMutationType(): GraphQLObjectType | undefined {
    const resolvers = [...this.resolvers];

    const someMutations = resolvers.some(resolver =>
      this.hasMutationResolvers(resolver.controller),
    );
    if (!someMutations) return;

    return new GraphQLObjectType({
      name: 'Mutation',
      fields: () => this.generateMutationResolverFields(),
    });
  }

  private buildRootSubscriptionType(): GraphQLObjectType | undefined {
    const resolvers = [...this.resolvers];

    const someSubscriptions = resolvers.some(resolver =>
      this.hasSubscriptionResolvers(resolver.controller),
    );
    if (!someSubscriptions) return;

    return new GraphQLObjectType({
      name: 'Subscription',
      fields: () => this.generateSubscriptionResolverFields(),
    });
  }

  private buildRootQueryType(): GraphQLObjectType | undefined {
    const resolvers = [...this.resolvers];

    const someQueries = resolvers.some(resolver =>
      this.hasQueryResolvers(resolver.controller),
    );
    if (!someQueries) {
      return new GraphQLObjectType({
        name: 'Query',
        fields: {
          _dummy: { type: GraphQLString },
        },
      });
    }

    return new GraphQLObjectType({
      name: 'Query',
      fields: () => this.generateQueryResolverFields(),
    });
  }

  addInputType<T>(type?: ReceiveType<T>): void {
    type = resolveReceiveType(type);

    if (!this.inputTypes.has(type)) {
      this.inputTypes.add(type);
    }
  }

  addOutputType<T>(type?: ReceiveType<T>): void {
    type = resolveReceiveType(type);

    if (!this.outputTypes.has(type)) {
      this.outputTypes.add(type);
    }
  }

  build(): GraphQLSchema {
    const query = this.buildRootQueryType();
    const mutation = this.buildRootMutationType();
    const subscription = this.buildRootSubscriptionType();
    const types = [...this.buildInputTypes(), ...this.buildOutputTypes()];

    const schema = new GraphQLSchema({
      query,
      mutation,
      subscription,
      types,
    });

    if (!this.options?.schemas?.length) return schema;

    return mergeSchemas({ schemas: [schema, ...this.options.schemas] });
  }
}
