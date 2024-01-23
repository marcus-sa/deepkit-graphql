import { GraphQLSchema } from 'graphql';
import { WebWorkerFactory, ApplicationServer } from '@deepkit/framework';
import { httpWorkflow } from '@deepkit/http';
import { Driver } from '@deepkit-graphql/core';
import { createYoga, YogaServerInstance } from 'graphql-yoga';
import { InjectorContext } from '@deepkit/injector';
import { Logger } from '@deepkit/logger';

import {
  YogaGraphQLConfig,
  YogaGraphQLServerOptions,
} from './yoga-graphql-config';

export class YogaDriver extends Driver {
  private server?: YogaServerInstance<any, any> | null;

  constructor(
    appServer: ApplicationServer,
    webWorkerFactory: WebWorkerFactory,
    private readonly config: YogaGraphQLConfig,
    private readonly logger: Logger,
  ) {
    super(appServer, webWorkerFactory);
  }

  async onRequest(
    event: typeof httpWorkflow.onRequest.event,
    injectorContext: InjectorContext,
  ): Promise<void> {
    if (!event.request.method || !this.server) return;

    await this.server.handle(event.request, event.response, injectorContext);
  }

  async start(schema: GraphQLSchema): Promise<void> {
    this.getOrCreateHttpServer();
    const logging =
      (this.config as YogaGraphQLServerOptions).logging || this.logger;
    this.server = createYoga({ schema, logging, ...this.config });
  }

  async stop() {
    this.server = null;
  }
}
