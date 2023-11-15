import { ReceiveType, resolveReceiveType, Type } from '@deepkit/type';
import { ClassType } from '@deepkit/core';
import {
  InjectorContext,
  InjectorInterface,
  InjectorModule,
} from '@deepkit/injector';
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

export interface SchemaBuilderOptions {
  readonly inputTypes?: readonly Type[];
  readonly outputTypes?: readonly Type[];
}

export function buildSchema(
  resolvers: Resolvers,
  injectorContext: InjectorContext = new InjectorContext(new InjectorModule()),
  options?: SchemaBuilderOptions,
): GraphQLSchema {
  return new SchemaBuilder(resolvers, injectorContext, options).build();
}

export class SchemaBuilder {
  private readonly inputTypes = new Set<Type>(this.options?.inputTypes);

  private readonly outputTypes = new Set<Type>(this.options?.outputTypes);

  private readonly typesBuilder = new TypesBuilder(
    this.resolvers,
    this.injectorContext,
  );

  constructor(
    private readonly resolvers: Resolvers,
    private readonly injectorContext: InjectorContext,
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

  generateMutationResolverFields(): GraphQLFieldConfigMap<unknown, unknown> {
    return [...this.resolvers.instances].reduce<
      GraphQLFieldConfigMap<unknown, unknown>
    >(
      (fields, instance) => ({
        // TODO: validate that fields don't override each other
        ...fields,
        ...this.typesBuilder.generateMutationResolverFields(instance),
      }),
      {},
    );
  }

  generateQueryResolverFields(): GraphQLFieldConfigMap<unknown, unknown> {
    return [...this.resolvers.instances].reduce<
      GraphQLFieldConfigMap<unknown, unknown>
    >(
      (fields, instance) => ({
        // TODO: validate that fields don't override each other
        ...fields,
        ...this.typesBuilder.generateQueryResolverFields(instance),
      }),
      {},
    );
  }

  private buildRootMutationType(): GraphQLObjectType | undefined {
    const classTypes = [...this.resolvers.classTypes];

    const someMutations = classTypes.some(classType =>
      this.hasMutationResolvers(classType),
    );
    if (!someMutations) return;

    return new GraphQLObjectType({
      name: 'Mutation',
      fields: () => this.generateMutationResolverFields(),
    });
  }

  /*private buildRootSubscriptionType(
    resolvers: Function[],
  ): GraphQLObjectType | undefined {
    const subscriptionsHandlers = this.filterHandlersByResolvers(
      getMetadataStorage().subscriptions,
      resolvers,
    );
    if (subscriptionsHandlers.length === 0) {
      return undefined;
    }

    return new GraphQLObjectType({
      name: 'Subscription',
      fields: this.generateSubscriptionsFields(subscriptionsHandlers),
    });
  }*/

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

  private buildRootQueryType(): GraphQLObjectType | undefined {
    const classTypes = [...this.resolvers.classTypes];

    const someQueries = classTypes.some(classType =>
      this.hasQueryResolvers(classType),
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
    const mutation = this.buildRootMutationType();
    const query = this.buildRootQueryType();
    const types = [...this.buildInputTypes(), ...this.buildOutputTypes()];

    return new GraphQLSchema({
      query,
      mutation,
      types,
    });
  }
}
