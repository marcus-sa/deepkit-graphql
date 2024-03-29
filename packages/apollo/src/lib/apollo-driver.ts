import * as url from 'node:url';
import { ApolloServer, HeaderMap, HTTPGraphQLRequest } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { InjectorContext } from '@deepkit/injector';
import { WebWorkerFactory, ApplicationServer } from '@deepkit/framework';
import { HttpBadRequestError, httpWorkflow } from '@deepkit/http';
import { Driver, GraphQLContext } from '@deepkit-graphql/core';
import { GraphQLSchema } from 'graphql';

import { ApolloGraphQLConfig } from './apollo-graphql-config';
import { ApolloServerPlugins } from './plugins';

export class ApolloDriver extends Driver {
  private server?: ApolloServer | null;

  constructor(
    appServer: ApplicationServer,
    webWorkerFactory: WebWorkerFactory,
    private readonly config: ApolloGraphQLConfig,
    private readonly plugins: ApolloServerPlugins,
  ) {
    super(appServer, webWorkerFactory);
  }

  async onRequest(
    event: typeof httpWorkflow.onRequest.event,
    injectorContext: InjectorContext,
  ): Promise<void> {
    if (!event.request.method) return;

    const requestHeaders = new HeaderMap();
    for (const [key, value] of Object.entries(event.request.headers)) {
      if (value) {
        // Node/Express headers can be an array or a single value. We join
        // multivalued headers with `, ` just like the Fetch API's `Headers`
        // does. We assume that keys are already lower-cased (as per the Node
        // docs on IncomingMessage.headers) and so we don't bother to lower-case
        // them or combine across multiple keys that would lower-case to the
        // same value.
        requestHeaders.set(
          key,
          Array.isArray(value) ? value.join(', ') : value,
        );
      }
    }

    const httpGraphQLRequest: HTTPGraphQLRequest = {
      method: event.request.method,
      headers: requestHeaders,
      search: url.parse(event.url).search ?? '',
      body: JSON.parse(await event.request.readBodyText()),
    };

    const response = await this.server!.executeHTTPGraphQLRequest({
      httpGraphQLRequest,
      context: async (): Promise<GraphQLContext> => ({ injectorContext }),
    });
    if (!response) {
      throw new HttpBadRequestError(JSON.stringify(httpGraphQLRequest));
    }

    const responseHeaders = Object.fromEntries(response.headers.entries());
    event.response.writeHead(
      response.status || 200,
      undefined,
      responseHeaders,
    );

    if (response.body.kind === 'complete') {
      event.response.write(response.body.string);
    } else {
      for await (const chunk of response?.body.asyncIterator) {
        event.response.write(chunk);
      }
    }

    event.response.end();
  }

  async start(schema: GraphQLSchema): Promise<void> {
    const httpServer = this.getOrCreateHttpServer();

    this.server = new ApolloServer({
      schema,
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
        ...this.plugins,
      ],
      ...this.config,
    });

    await this.server.start();
  }

  async stop() {
    await this.server?.stop();
    this.server = null;
  }
}
