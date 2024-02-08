import { createModule } from '@deepkit/app';
import { GraphQLModule } from '@deepkit-graphql/core';
import { ApolloServerPlugin } from '@apollo/server/dist/esm/externalTypes/plugins';

import { ApolloDriver } from './apollo-driver';
import {
  ApolloGraphQLConfig,
  ApolloServerOptions,
} from './apollo-graphql-config';
import { ApolloServerPlugins } from './plugins';
import { ApolloFederationDriver } from './apollo-federation-driver';

export interface ApolloGraphQLModuleOptions extends ApolloServerOptions {
  readonly plugins?: readonly ApolloServerPlugin[];
  readonly federation?: boolean;
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
    const config = this.config as ApolloGraphQLModuleOptions;
    if (config.federation) {
      this.addImport(new GraphQLModule(ApolloFederationDriver));
    } else if (config.gateway) {
      // TODO: Dunno if we need a custom driver for gateway
    } else {
      this.addImport(new GraphQLModule(ApolloDriver));
    }
  }

  addPlugin(plugin: ApolloServerPlugin): this {
    this.plugins.add(plugin);
    return this;
  }
}
