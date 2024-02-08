import { AbstractClassType } from '@deepkit/core';
import {
  ReflectionClass,
  ReflectionProperty,
  Type,
  TypeClass,
} from '@deepkit/type';

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

export class MissingNumberDecoratorError extends Error {
  constructor() {
    super(`Add a decorator to type "number"`);
  }
}

export class UnsupportedScalarTypeForClassError extends Error {
  constructor(type: TypeClass) {
    super(`Class ${type.classType.name} is not a supported scalar type`);
  }
}

export class UnsupportedScalarTypeError extends Error {
  constructor(type: Type) {
    // TODO: if kind is any, never or unknown show a help text indicating that reflection might not be enabled
    super(
      `Type ${type.typeName} with kind ${type.kind} is not a supported scalar type`,
    );
  }
}

export class MissingDirectiveAnnotationError extends Error {
  constructor(
    readonly property: ReflectionProperty,
    readonly clazz: ReflectionClass<unknown>,
    readonly name: string,
  ) {
    super(
      `Property "${property.name}" on type "${clazz.type.typeName}" is missing "${name}" directive annotation`,
    );
  }
}

export class MissingTypeArgumentError extends Error {
  constructor(readonly type: Type) {
    super(`Missing type argument for ${type.typeName}`);
  }
}

export class MissingResolverDecoratorError extends Error {
  constructor(readonly classType: AbstractClassType) {
    super(`Missing @graphql.resolver() decorator on ${classType.name}`);
  }
}
