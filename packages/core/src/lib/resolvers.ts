import { InjectorModule } from '@deepkit/injector';
import { ClassType } from '@deepkit/core';

import { Instance } from './types';

export class DeepkitGraphQLResolvers extends Set<{
  readonly module: InjectorModule;
  readonly controller: ClassType;
}> {}

export class Resolvers extends WeakMap<ClassType, Instance> {
  readonly classTypes = new Set<ClassType>();

  readonly instances = new Set<Instance>();

  constructor(instances: readonly Instance[]) {
    const entries = instances.map<readonly [ClassType, Instance]>(instance => [
      instance.constructor,
      instance,
    ]);
    super(entries);
    entries.forEach(([classType]) => this.classTypes.add(classType));
    instances.forEach(instance => this.instances.add(instance));
  }
}
