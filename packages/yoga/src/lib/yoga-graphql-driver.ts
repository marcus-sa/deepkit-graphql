import { GraphQLSchema } from 'graphql';
import { WebWorkerFactory, ApplicationServer } from '@deepkit/framework';
import { httpWorkflow } from '@deepkit/http';
import { Driver, GraphQLHttpContext } from '@deepkit-graphql/core';
import { createYoga, YogaServerInstance } from 'graphql-yoga';
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

  async onRequest(event: typeof httpWorkflow.onRequest.event): Promise<void> {
    if (!event.request.method || !this.server) return;

    const context: GraphQLHttpContext = {
      request: event.request,
      response: event.response,
    };

    await this.server.handle(event.request, event.response, context);
  }

  async start(schema: GraphQLSchema): Promise<void> {
    this.getOrCreateHttpServer();
    const logging: any =
      (this.config as YogaGraphQLServerOptions).logging || this.logger;
    if (logging && this.logger) {
      // @ts-ignore
      logging.warn = this.logger.warning;
    }
    this.server = createYoga({ schema, logging, ...this.config });
  }

  async stop() {
    this.server = null;
  }
}
