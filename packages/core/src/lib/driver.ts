import { GraphQLSchema } from 'graphql';

export abstract class Driver {
  // ReferenceError: http_1 is not defined
  // async onRequest(event: typeof httpWorkflow.onRequest.event): Promise<void> {}
  async onRequest(event: any): Promise<void> {
    throw new Error('Not yet implemented');
  }

  async start(schema: GraphQLSchema): Promise<void> {
    throw new Error('Not yet implemented');
  }

  async stop(): Promise<void> {
    throw new Error('Not yet implemented');
  }
}
