import { InjectorContext } from '@deepkit/injector';
import { eventDispatcher } from '@deepkit/event';
import { httpWorkflow } from '@deepkit/http';
import {
  onServerMainBootstrapDone,
  onServerMainShutdown,
} from '@deepkit/framework';

import { Driver } from './driver';
import { DeepkitGraphQLResolvers, Resolvers } from './resolvers';
import { buildSchema } from './schema-builder';

export class GraphQLServer {
  constructor(
    private readonly resolvers: DeepkitGraphQLResolvers,
    private readonly injectorContext: InjectorContext,
    private readonly driver: Driver,
  ) {}

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

    const schema = buildSchema({ resolvers });
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
