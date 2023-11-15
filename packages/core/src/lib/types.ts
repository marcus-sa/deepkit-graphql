import { ClassType, AbstractClassType } from '@deepkit/core';

export type GraphQLFields<T> = Record<string, { readonly type: T }>;

export const PARENT_META_NAME = 'parent';

// eslint-disable-next-line functional/prefer-readonly-type
export type Parent<T> = T & { __meta?: [typeof PARENT_META_NAME, T] };

export const CONTEXT_META_NAME = 'context';

// eslint-disable-next-line functional/prefer-readonly-type
export type Context<T> = T & { __meta?: [typeof CONTEXT_META_NAME, T] };

// eslint-disable-next-line @typescript-eslint/ban-types
export type Instance<T = any> = T & {
  readonly constructor: AbstractClassType<T>;
};

export type ID = string | number;

export interface GraphQLMiddleware {
  execute: GraphQLMiddlewareFn;
}

export type GraphQLMiddlewareFn = (
  context: Context<unknown>,
  next: (err?: Error) => void,
) => Promise<void> | void;

export type InternalMiddleware =
  | ClassType<GraphQLMiddleware>
  | GraphQLMiddlewareFn;
