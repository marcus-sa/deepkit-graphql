import { AppModule, createModule } from '@deepkit/app';
import { ControllerConfig } from '@deepkit/app';
import { ReceiveType, resolveReceiveType } from '@deepkit/type';
import { ClassType } from '@deepkit/core';

import { gqlClassDecorator } from './decorators';
import { DeepkitGraphQLResolvers } from './resolvers';
import { GraphQLServer } from './graphql-server';
import { Driver } from './driver';

export class GraphQLModule extends createModule({
  listeners: [GraphQLServer],
  forRoot: true,
}) {
  readonly resolvers: DeepkitGraphQLResolvers = new DeepkitGraphQLResolvers();

  constructor(private readonly driver: ClassType<Driver>) {
    super();
  }

  process(): void {
    this.addProvider({
      provide: DeepkitGraphQLResolvers,
      useValue: this.resolvers,
    });
    // TODO: https://discord.com/channels/759513055117180999/956485358382624790/1148211788270280814
    this.addProvider({
      provide: Driver,
      useClass: this.driver,
    });
  }

  // TODO
  addType<T>(type?: ReceiveType<T>): this {
    type = resolveReceiveType(type);
    return this;
  }

  processController(
    module: AppModule<any>,
    { controller }: ControllerConfig,
  ): void {
    if (!controller) return;

    const resolver = gqlClassDecorator._fetch(controller);
    if (!resolver) return;

    if (!module.isProvided(controller)) {
      module.addProvider({ provide: controller, scope: 'graphql' });
    }

    this.resolvers.add({ controller, module });
  }
}
