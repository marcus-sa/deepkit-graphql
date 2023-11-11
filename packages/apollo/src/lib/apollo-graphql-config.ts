import { ApolloServerOptionsWithSchema } from '@apollo/server';

export class ApolloGraphQLConfig
  implements
    Pick<
      ApolloServerOptionsWithSchema<{}>,
      | 'introspection'
      | 'nodeEnv'
      | 'allowBatchedHttpRequests'
      | 'csrfPrevention'
      | 'includeStacktraceInErrorResponses'
      | 'apollo'
      | 'stopOnTerminationSignals'
      | 'persistedQueries'
    > {}
