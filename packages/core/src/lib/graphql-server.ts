import { InjectorContext } from '@deepkit/injector';
import { eventDispatcher } from '@deepkit/event';
import { httpWorkflow } from '@deepkit/http';
import {
  onServerMainBootstrapDone,
  onServerMainShutdown,
} from '@deepkit/framework';

import { Driver } from './driver';
import { DeepkitGraphQLResolvers, Resolvers } from './resolvers';
import { SchemaBuilder } from './schema-builder';

export class GraphQLServer {
  private readonly injectorContext: InjectorContext;

  constructor(
    private readonly resolvers: DeepkitGraphQLResolvers,
    private readonly driver: Driver,
    injectorContext: InjectorContext,
  ) {
    this.injectorContext = injectorContext.createChildScope('graphql');
  }

  private createResolvers(): Resolvers {
    return new Resolvers(
      [...this.resolvers.values()].map(({ controller, module }) =>
        this.injectorContext.get(controller, module),
      ),
    );
  }

  @eventDispatcher.listen(onServerMainBootstrapDone)
  async onServerMainBootstrapDone(): Promise<void> {
    const resolvers = this.createResolvers();
    const schemaBuilder = new SchemaBuilder(resolvers, this.injectorContext);
    const schema = schemaBuilder.build();
    await this.driver.start(schema);
  }

  @eventDispatcher.listen(onServerMainShutdown)
  async onServerMainShutdown(): Promise<void> {
    await this.driver.stop();
  }

  @eventDispatcher.listen(httpWorkflow.onRequest)
  async onRequest(event: typeof httpWorkflow.onRequest.event): Promise<void> {
    await this.driver.onRequest(event);
  }
}
