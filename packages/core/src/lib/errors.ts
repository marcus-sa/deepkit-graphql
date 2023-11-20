import { Type } from '@deepkit/type';

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
      `The return type of "${methodName}" method on "${className}" class must be AsyncGenerator<T>, AsyncIterable<T>, Observable<T> or BrokerBus<T> when @graphql.subscription() decorator is used`,
    );
  }
}
