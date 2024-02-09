import { ReceiveType, resolveReceiveType, Type } from '@deepkit/type';
import { ClassType } from '@deepkit/core';
import { mergeSchemas } from '@graphql-tools/schema';
import { InjectorContext } from '@deepkit/injector';
import {
  defaultFieldResolver,
  DirectiveLocation,
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
import { Directives, InternalDirective } from './directives';
import {
  getDirective,
  MapperKind,
  mapSchema,
  SchemaMapper,
} from '@graphql-tools/utils';

export interface SchemaBuilderOptions {
  readonly inputTypes?: readonly Type[];
  readonly outputTypes?: readonly Type[];
  readonly orphanedTypes?: readonly Type[];
  readonly schemas?: readonly GraphQLSchema[];
  readonly directives?: Directives;
}

export async function buildSchema(
  resolvers: Resolvers,
  injectorContext: InjectorContext,
  options?: SchemaBuilderOptions,
): Promise<GraphQLSchema> {
  return await new SchemaBuilder(resolvers, injectorContext, options).build();
}

export class SchemaBuilder {
  private readonly inputTypes = new Set<Type>(this.options?.inputTypes);

  private readonly outputTypes = new Set<Type>(this.options?.outputTypes);

  private readonly typesBuilder = new TypesBuilder(this.resolvers);

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

  private getDirectives(): readonly InternalDirective<any>[] {
    return (this.options?.directives ? [...this.options.directives] : []).map(
      classType => this.injectorContext.get(classType),
    );
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

  private async transformSchemaUsingDirective(
    schema: GraphQLSchema,
    directive: InternalDirective<any>,
  ): Promise<GraphQLSchema> {
    const schemaMapper: SchemaMapper = {};

    if (typeof directive.transformObjectField === 'function') {
      schemaMapper[MapperKind.OBJECT_FIELD] = fieldConfig => {
        const fieldDirective = getDirective(
          schema,
          fieldConfig,
          directive.name,
        )?.[0];

        if (fieldDirective) {
          const transform = directive.transformObjectField!(
            fieldDirective,
            fieldConfig,
            schema,
          );
          fieldConfig.resolve = (source, args, context, info) => {
            console.log(directive.args);
          };
        }

        return fieldConfig;
      };
    }

    return mapSchema(schema, schemaMapper);
  }

  async build(): Promise<GraphQLSchema> {
    const query = this.buildRootQueryType();
    const mutation = this.buildRootMutationType();
    const subscription = this.buildRootSubscriptionType();
    const types = [...this.buildInputTypes(), ...this.buildOutputTypes()];
    const directives = this.getDirectives();

    let schema = new GraphQLSchema({
      query,
      mutation,
      subscription,
      types,
      directives,
    });

    for (const directive of directives) {
      schema = await this.transformSchemaUsingDirective(schema, directive);
    }

    if (!this.options?.schemas?.length) return schema;

    return mergeSchemas({ schemas: [schema, ...this.options.schemas] });
  }
}
