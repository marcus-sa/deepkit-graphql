import { GraphQLSchema } from 'graphql';
import { WebWorkerFactory, ApplicationServer } from '@deepkit/framework';
import { httpWorkflow } from '@deepkit/http';
import { Driver, GraphQLContext } from '@deepkit-graphql/core';
import { createYoga, YogaServerInstance } from 'graphql-yoga';
import { TypeSource } from '@graphql-tools/utils';
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

    await this.server.handle(event.request, event.response, <GraphQLContext>{
      injectorContext,
    });
  }

  async start(schema: TypeSource): Promise<void> {
    if (!(schema instanceof GraphQLSchema)) {
      throw new Error(
        'Only GraphQLSchema is supported as TypeSource for YogaDriver',
      );
    }
    this.getOrCreateHttpServer();
    const logging =
      (this.config as YogaGraphQLServerOptions).logging || this.logger;
    this.server = createYoga({ schema, logging, ...this.config });
  }

  async stop() {
    this.server = null;
  }
}
