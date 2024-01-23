import { ClassType, AbstractClassType } from '@deepkit/core';
import { TypeAnnotation } from '@deepkit/type';
import { InjectorContext } from '@deepkit/injector';

export type GraphQLFields<T> = Record<string, { readonly type: T }>;

export const PARENT_META_NAME = 'parent';

export type Parent<T> = T & TypeAnnotation<typeof PARENT_META_NAME, T>;

export const CONTEXT_META_NAME = 'context';

export type Context<T> = T & TypeAnnotation<typeof CONTEXT_META_NAME, T>;

// eslint-disable-next-line @typescript-eslint/ban-types
export type Instance<T = any> = T & {
  readonly constructor: AbstractClassType<T>;
};

export type ID = string | number;

export interface GraphQLMiddleware {
  execute: GraphQLMiddlewareFn;
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
