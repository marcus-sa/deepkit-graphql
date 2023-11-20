import { GraphQLSchema } from 'graphql';
import { ApplicationServer, WebWorker, WebWorkerFactory } from '@deepkit/framework';
import * as https from 'node:https';
import * as http from 'node:http';

export abstract class Driver {
  protected constructor(
    protected readonly appServer: ApplicationServer,
    protected readonly webWorkerFactory: WebWorkerFactory,
  ) {}

  // ReferenceError: http_1 is not defined
  // async onRequest(event: typeof httpWorkflow.onRequest.event): Promise<void> {}
  abstract onRequest(event: any): Promise<void>;

  abstract start(schema: GraphQLSchema): Promise<void>;

  abstract stop(): Promise<void>;

  protected getOrCreateHttpServer(): https.Server | http.Server {
    let httpWorker: WebWorker & any;
    try {
      httpWorker = this.appServer.getHttpWorker() as any;
    } catch {
      (this.appServer as any).httpWorker = this.webWorkerFactory.create(
        1,
        this.appServer.config,
      );
      (this.appServer as any).httpWorker.start();
      httpWorker = this.appServer.getHttpWorker() as any;
    }
    return  httpWorker.servers || httpWorker.server;
  }
}
