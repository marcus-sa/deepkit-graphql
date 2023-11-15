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
