import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLScalarType,
  GraphQLScalarTypeConfig,
  GraphQLString,
  Kind,
  ValueNode,
} from 'graphql';
import {
  GraphQLBigInt,
  GraphQLByte,
  GraphQLDateTime,
  GraphQLNegativeFloat,
  GraphQLNegativeInt,
  GraphQLNonNegativeFloat,
  GraphQLNonNegativeInt,
  GraphQLNonPositiveFloat,
  GraphQLNonPositiveInt,
  GraphQLPositiveFloat,
  GraphQLPositiveInt,
  GraphQLUUID,
  GraphQLVoid,
} from 'graphql-scalars';

export function raise(error: string): never {
  throw new Error(error);
}

/** @reflection never */
export type ValueType =
  | Record<string, unknown>
  | string
  | boolean
  | number
  | null
  | readonly ValueType[];

export function parseLiteral(ast: ValueNode): ValueType | readonly ValueType[] {
  switch (ast.kind) {
    case Kind.LIST:
      return ast.values.map(value => parseLiteral(value));
    case Kind.NULL:
      return null;
    case Kind.OBJECT:
      return ast.fields.reduce(
        (obj, field) => ({
          ...obj,
          [field.name.value]: parseLiteral(field.value),
        }),
        {} as Record<string, unknown>,
      );

    default:
      return 'value' in ast
        ? ast.value
        : raise(`GraphQL AST Node ${ast.kind} is not supported`);
  }
}

export function transformScalar<
  S extends GraphQLScalarType<unknown, unknown>,
  T,
>(scalar: S): S {
  return Object.assign(scalar, {
    serialize: value => value,
    parseValue: value => value,
    parseLiteral,
  } as GraphQLScalarTypeConfig<unknown, unknown>);
}

export const Boolean = transformScalar(GraphQLBoolean);

export const ID = transformScalar(GraphQLID);

export const Void = transformScalar(GraphQLVoid);

export const BigInt = transformScalar(GraphQLBigInt);

export const PositiveFloat = transformScalar(GraphQLPositiveFloat);

export const NegativeFloat = transformScalar(GraphQLNegativeFloat);

export const NonPositiveFloat = transformScalar(GraphQLNonPositiveFloat);

export const NonNegativeFloat = transformScalar(GraphQLNonNegativeFloat);

export const Float = transformScalar(GraphQLFloat);

export const PositiveInt = transformScalar(GraphQLPositiveInt);

export const NegativeInt = transformScalar(GraphQLNegativeInt);

export const NonPositiveInt = transformScalar(GraphQLNonPositiveInt);

export const NonNegativeInt = transformScalar(GraphQLNonNegativeInt);

export const Int = transformScalar(GraphQLInt);

export const String = transformScalar(GraphQLString);

export const UUID = transformScalar(GraphQLUUID);

export const DateTime = transformScalar(GraphQLDateTime);

export const Byte = transformScalar(GraphQLByte);
