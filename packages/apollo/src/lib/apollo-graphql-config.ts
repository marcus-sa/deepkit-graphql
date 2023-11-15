import { ApolloServerOptionsWithSchema } from '@apollo/server';

export type ApolloServerOptions = Pick<
  ApolloServerOptionsWithSchema<{}>,
  | 'introspection'
  | 'nodeEnv'
  | 'allowBatchedHttpRequests'
  | 'csrfPrevention'
  | 'includeStacktraceInErrorResponses'
  | 'apollo'
  | 'stopOnTerminationSignals'
  | 'persistedQueries'
>;

export class ApolloGraphQLConfig implements ApolloServerOptions {}
