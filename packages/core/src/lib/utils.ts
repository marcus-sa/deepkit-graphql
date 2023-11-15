import {
  metaAnnotation,
  ReflectionKind,
  ReflectionParameter,
  stringifyType,
  Type,
  TypeClass,
  TypeNull,
  TypeObjectLiteral,
  TypeUndefined,
} from '@deepkit/type';

import { TypeNameRequiredError, UnknownTypeNameError } from './errors';
import { CONTEXT_META_NAME, Instance, PARENT_META_NAME } from './types';
import { gqlClassDecorator, GraphQLClassMetadata } from './decorators';
import { AbstractClassType, ClassType } from '@deepkit/core';

export function getParentMetaAnnotationReflectionParameterIndex(
  parameters: readonly ReflectionParameter[],
): number {
  return parameters.findIndex(({ parameter }) =>
    metaAnnotation.getForName(parameter.type, PARENT_META_NAME),
  );
}

export function getContextMetaAnnotationReflectionParameterIndex(
  parameters: readonly ReflectionParameter[],
): number {
  return parameters.findIndex(({ parameter }) =>
    metaAnnotation.getForName(parameter.type, CONTEXT_META_NAME),
  );
}

export function filterReflectionParametersMetaAnnotationsForArguments(
  parameters: readonly ReflectionParameter[],
): readonly ReflectionParameter[] {
  const argsParameters = [...parameters];

  const parentIndex =
    getParentMetaAnnotationReflectionParameterIndex(argsParameters);

  if (parentIndex !== -1) {
    // eslint-disable-next-line functional/immutable-data
    argsParameters.splice(parentIndex, 1);
  }

  const contextIndex =
    getContextMetaAnnotationReflectionParameterIndex(argsParameters);

  if (contextIndex !== -1) {
    // eslint-disable-next-line functional/immutable-data
    argsParameters.splice(contextIndex, 1);
  }

  return argsParameters;
}

export function requireTypeName(type: TypeObjectLiteral | TypeClass): string {
  const name = getTypeName(type);
  if (!name) {
    throw new TypeNameRequiredError(type);
  }
  if (name.startsWith('UnknownTypeName:()=>')) {
    throw new UnknownTypeNameError(type);
  }
  return name;
}

export function excludeNullAndUndefinedTypes(
  types: readonly Type[],
): readonly Exclude<Type, TypeUndefined | TypeNull>[] {
  return types.filter(
    type =>
      type.kind !== ReflectionKind.undefined &&
      type.kind !== ReflectionKind.null,
  ) as readonly Exclude<Type, TypeUndefined | TypeNull>[];
}

export function unwrapPromiseLikeType(type: Type): Type {
  return type.kind === ReflectionKind.promise ? type.type : type;
}

const removeNonAlphanumericCharacters = (text: string) =>
  text.replace(/\W/g, '');

export const getTypeName = (type: Type): string =>
  removeNonAlphanumericCharacters(stringifyType(type));

export function raise(error: string): never {
  throw new Error(error);
}

export function getClassDecoratorMetadata<T>(
  classType: AbstractClassType<T>,
): GraphQLClassMetadata {
  const resolver = gqlClassDecorator._fetch(classType);
  if (!resolver) {
    throw new Error(
      `Missing @graphql.resolver() decorator on ${classType.name}`,
    );
  }
  return resolver;
}
