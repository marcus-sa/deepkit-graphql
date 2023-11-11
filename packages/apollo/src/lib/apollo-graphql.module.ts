import { createModule } from '@deepkit/app';
import { GraphQLModule } from '@deepkit-graphql/core';
import { ApolloServerPlugin } from '@apollo/server/dist/esm/externalTypes/plugins';

import { ApolloDriver } from './apollo-graphql-driver';
import { ApolloGraphQLConfig } from './apollo-graphql-config';
import { ApolloServerPlugins } from './plugins';

export class ApolloGraphQLModule extends createModule({
  config: ApolloGraphQLConfig,
  forRoot: true,
}) {
  readonly plugins = new ApolloServerPlugins();

  process() {
    this.addProvider({
      provide: ApolloServerPlugins,
      useValue: this.plugins,
    });
    this.addModuleImport(
      new GraphQLModule(ApolloDriver),
    );
  }

  addPlugin(plugin: ApolloServerPlugin): this {
    this.plugins.add(plugin);
    return this;
  }
}

