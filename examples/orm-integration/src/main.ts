import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { ApolloGraphQLModule } from '@deepkit-graphql/apollo';

import { PostResolver, UserResolver } from './resolvers';
import { Config } from './config';
import { Database } from './db';
import { PostRepository, UserRepository } from './repositories';

void new App({
  config: Config,
  imports: [
    new FrameworkModule({ port: 8080 }),
    new ApolloGraphQLModule({ introspection: true }),
  ],
  listeners: [Database],
  controllers: [PostResolver, UserResolver],
  providers: [Database, UserRepository, PostRepository],
})
  .loadConfigFromEnv({ prefix: 'NX_' })
  .run(['server:start']);
