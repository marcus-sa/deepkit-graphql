import { Type } from '@deepkit/type';
import { AbstractClassType } from '@deepkit/core';

export class TypeNameRequiredError extends Error {
  constructor(readonly type: Type) {
    super('Type requires a name');
  }
}

export class UnknownTypeNameError extends Error {
  constructor(readonly type: Type) {
    super('Unknown type name');
  }
}

export class InvalidSubscriptionTypeError extends Error {
  constructor(readonly type: Type, className: string, methodName: string) {
    super(
      `The return type of "${methodName}" method on "${className}" class must be one of AsyncGenerator<T>, AsyncIterable<T>, Observable<T> or BrokerBusChannel<T> when @graphql.subscription() decorator is used`,
    );
  }
}

export class MissingTypeArgumentError extends Error {
  constructor(readonly type: Type) {
    super(`Missing type argument for ${type.typeName}<T>`);
  }
}

export class MissingResolverDecoratorError extends Error {
  constructor(readonly classType: AbstractClassType) {
    super(`Missing @graphql.resolver() decorator on ${classType.name}`);
  }
}
