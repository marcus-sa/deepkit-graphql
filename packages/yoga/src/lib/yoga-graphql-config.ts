import { YogaServerOptions } from 'graphql-yoga';

export type YogaGraphQLServerOptions = Omit<
  YogaServerOptions<any, any>,
  'schema' | 'context'
>;

export class YogaGraphQLConfig implements YogaGraphQLServerOptions {}
