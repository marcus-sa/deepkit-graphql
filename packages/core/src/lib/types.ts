import { ClassType } from '@deepkit/core';
import { TypeAnnotation } from '@deepkit/type';
import { InjectorContext } from '@deepkit/injector';
import type { ApolloGraphQLObjectTypeExtensions } from '@apollo/subgraph/dist/schemaExtensions';
import { ConstDirectiveNode } from 'graphql';

export type GraphQLFields<T> = Record<string, { readonly type: T }>;

export const PARENT_META_NAME = 'parent';

export type Parent<T> = T & TypeAnnotation<typeof PARENT_META_NAME, T>;

export const CONTEXT_META_NAME = 'context';

export type Context<T> = T & TypeAnnotation<typeof CONTEXT_META_NAME, T>;

export type ID = string | number;

export interface GraphQLMiddleware {
  readonly execute: GraphQLMiddlewareFn;
}

export type GraphQLMiddlewareFn = (
  next: (err?: Error) => void,
) => Promise<void> | void;

export type InternalMiddleware =
  | ClassType<GraphQLMiddleware>
  | GraphQLMiddlewareFn;

export interface GraphQLContext {
  readonly injectorContext: InjectorContext;
}

export interface GraphQLObjectTypeExtensions
  extends ApolloGraphQLObjectTypeExtensions<unknown, GraphQLContext> {
  // TODO: not sure if GraphQLDirective or ConstDirectiveNode is expected
  // https://the-guild.dev/graphql/tools/docs/schema-directives#what-about-code-first-schemas
  directives?: readonly ConstDirectiveNode[];
}
