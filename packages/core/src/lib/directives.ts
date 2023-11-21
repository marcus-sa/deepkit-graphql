import {
  GraphQLDirective,
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
} from 'graphql';
import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '@graphql-tools/utils';

export const DIRECTIVE_META_NAME = 'directive';

export type Directive<
  D extends GraphQLDirective | string,
  A extends any[] = [],
> = { __meta?: [typeof DIRECTIVE_META_NAME, D, A] };

export type Defer = Directive<typeof GraphQLDeferDirective>;

export type Stream = Directive<typeof GraphQLStreamDirective>;

export type Skip = Directive<typeof GraphQLSkipDirective>;

export type Include = Directive<typeof GraphQLIncludeDirective>;

// TODO: use jsdoc @deprecated instead
// export type Deprecated = Directive<'deprecated', { reason: string }>;
