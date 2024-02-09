import { InjectorContext } from '@deepkit/injector';
import { eventDispatcher } from '@deepkit/event';
import { HttpRequest, HttpResponse, httpWorkflow } from '@deepkit/http';
import {
  onServerMainBootstrapDone,
  onServerMainShutdown,
} from '@deepkit/framework';

import { Driver } from './driver';
import { Resolvers } from './resolvers';
import { buildSchema } from './schema-builder';
import { Directives } from './directives';

export class GraphQLServer {
  constructor(
    private readonly resolvers: Resolvers,
    private readonly driver: Driver,
    private readonly injectorContext: InjectorContext,
    private readonly directives: Directives,
  ) {}

  @eventDispatcher.listen(onServerMainBootstrapDone)
  async onServerMainBootstrapDone(): Promise<void> {
    const schema = await buildSchema(this.resolvers, this.injectorContext, {
      directives: this.directives,
    });
    await this.driver.start(schema);
  }

  @eventDispatcher.listen(onServerMainShutdown)
  async onServerMainShutdown(): Promise<void> {
    await this.driver.stop();
  }

  @eventDispatcher.listen(httpWorkflow.onRequest)
  async onRequest(event: typeof httpWorkflow.onRequest.event): Promise<void> {
    const injectorContext = this.injectorContext.createChildScope('graphql');
    injectorContext.set(InjectorContext, injectorContext);
    injectorContext.set(HttpRequest, event.request);
    injectorContext.set(HttpResponse, event.response);

    await this.driver.onRequest(event, injectorContext);
  }
}
