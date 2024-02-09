import { AppModule, createModule } from '@deepkit/app';
import { ControllerConfig } from '@deepkit/app';
import { ReceiveType, resolveReceiveType } from '@deepkit/type';
import { ClassType } from '@deepkit/core';

import { gqlClassDecorator } from './decorators';
import { GraphQLServer } from './graphql-server';
import { Driver } from './driver';
import { Resolvers } from './resolvers';
import { InternalDirective, Directives } from './directives';

export interface GraphQLModuleOptions {
  readonly driver?: ClassType<Driver>;
  readonly directives?: readonly ClassType<InternalDirective<any>>[];
}

export class GraphQLModule extends createModule({
  forRoot: true,
}) {
  readonly directives: Directives = new Directives(this._options?.directives);
  readonly resolvers: Resolvers = new Resolvers();

  constructor(private readonly _options?: GraphQLModuleOptions) {
    super();
  }

  process(): void {
    this.addProvider({
      provide: Directives,
      useValue: this.directives,
    });

    this.directives.forEach(directive => this.addProvider(directive));

    this.addProvider({
      provide: Resolvers,
      useValue: this.resolvers,
    });

    // TODO: https://discord.com/channels/759513055117180999/956485358382624790/1148211788270280814

    if (this._options?.driver) {
      this.addProvider({
        provide: Driver,
        useClass: this._options.driver,
      });
      this.addListener(GraphQLServer);
    }
  }

  // TODO
  addType<T>(type?: ReceiveType<T>): this {
    type = resolveReceiveType(type);
    return this;
  }

  addDirective<T extends InternalDirective<any>>(value: ClassType<T>): this {
    this.directives.add(value);
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
