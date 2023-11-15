import { HttpRequest, HttpResponse } from '@deepkit/http';

import { Context } from './types';

export type GraphQLHttpContext = Context<{
  readonly request: HttpRequest;
  readonly response: HttpResponse;
}>;
