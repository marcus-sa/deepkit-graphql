import { createModule } from '@deepkit/app';
import { GraphQLModule } from '@deepkit-graphql/core';
import { ApolloServerPlugin } from '@apollo/server/dist/esm/externalTypes/plugins';

import { ApolloDriver } from './apollo-graphql-driver';
import {
  ApolloGraphQLConfig,
  ApolloServerOptions,
} from './apollo-graphql-config';
import { ApolloServerPlugins } from './plugins';

export interface ApolloGraphQLModuleOptions extends ApolloServerOptions {
  readonly plugins?: readonly ApolloServerPlugin[];
}

export class ApolloGraphQLModule extends createModule({
  config: ApolloGraphQLConfig,
  forRoot: true,
}) {
  readonly plugins: ApolloServerPlugins;

  constructor({ plugins, ...options }: ApolloGraphQLModuleOptions) {
    super(options);
    this.plugins = new ApolloServerPlugins(plugins);
  }

  process() {
    this.addProvider({
      provide: ApolloServerPlugins,
      useValue: this.plugins,
    });
    this.addImport(new GraphQLModule(ApolloDriver));
  }

  addPlugin(plugin: ApolloServerPlugin): this {
    this.plugins.add(plugin);
    return this;
  }
}
