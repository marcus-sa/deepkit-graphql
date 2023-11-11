import { ClassType } from '@deepkit/core';
import { Type } from '@deepkit/type';

import { Driver } from './driver';

export class GraphQLConfig {
  // readonly driver: ClassType<Driver>;
  readonly types?: readonly Type[];
}
