import { createModule } from '@deepkit/app';
import { GraphQLModule } from '@deepkit-graphql/core';

import { YogaDriver } from './yoga-graphql-driver';
import {
  YogaGraphQLConfig,
  YogaGraphQLServerOptions,
} from './yoga-graphql-config';

export class YogaGraphQLModule extends createModule({
  config: YogaGraphQLConfig,
  forRoot: true,
}) {

  constructor(options: YogaGraphQLServerOptions) {
    super(options);
  }

  process() {
    this.addImport(new GraphQLModule(YogaDriver));
  }
}
