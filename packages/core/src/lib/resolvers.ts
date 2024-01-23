import { InjectorModule } from '@deepkit/injector';
import { ClassType } from '@deepkit/core';

export interface Resolver<T> {
  readonly controller: ClassType<T>;
  readonly module?: InjectorModule;
}

export class Resolvers extends Set<Resolver<unknown>> {}
