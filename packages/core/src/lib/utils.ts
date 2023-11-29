import { AbstractClassType } from '@deepkit/core';
import { BrokerBusChannel } from '@deepkit/broker';
import { Observable } from 'rxjs';
import {
  metaAnnotation,
  ReflectionClass,
  ReflectionKind,
  excludedAnnotation,
  ReflectionParameter,
  ReflectionProperty,
  stringifyType,
  Type,
  TypeClass,
  TypeNull,
  TypeObjectLiteral,
  TypeUndefined,
} from '@deepkit/type';

import {
  MissingResolverDecoratorError,
  MissingTypeArgumentError,
  UnknownTypeNameError,
} from './errors';
import { CONTEXT_META_NAME, PARENT_META_NAME } from './types';
import { gqlClassDecorator, GraphQLClassMetadata } from './decorators';

export function isAsyncIterable(obj: unknown): obj is AsyncIterable<unknown> {
  return obj != null && typeof obj === 'object' && Symbol.asyncIterator in obj;
}

export function transformAsyncIteratorResult<In, Out>(
  asyncIterable: AsyncIterable<In>,
  callback: (value: In) => Out,
): AsyncIterable<Out> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<Out> {
      const asyncIterator = asyncIterable[Symbol.asyncIterator]();

      return {
        async next(): Promise<IteratorResult<Out>> {
          const { done, value } = await asyncIterator.next();

          return {
            value: callback(value),
            done,
          };
        },
      };
    },
  };
}

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
    argsParameters.splice(parentIndex, 1);
  }

  const contextIndex =
    getContextMetaAnnotationReflectionParameterIndex(argsParameters);

  if (contextIndex !== -1) {
    argsParameters.splice(contextIndex, 1);
  }

  return argsParameters;
}

export function requireTypeName(type: TypeObjectLiteral | TypeClass): string {
  const name = getTypeName(type);
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

export function getTypeArgument(type: Type): Type {
  const typeArgument = type.typeArguments?.[0];
  if (!typeArgument) {
    throw new MissingTypeArgumentError(type);
  }
  return typeArgument;
}

export function maybeUnwrapSubscriptionReturnType(type: Type): Type {
  switch (true) {
    case type.typeName === 'Generator':
    case type.typeName === 'AsyncGenerator':
    case type.typeName === 'AsyncIterable':
    case (type as TypeClass).classType === BrokerBusChannel:
    case (type as TypeClass).classType === Observable:
      return getTypeArgument(type);

    default:
      return type;
  }
}

export function maybeUnwrapPromiseLikeType(type: Type): Type {
  return type.kind === ReflectionKind.promise ? type.type : type;
}

const removeNonAlphanumericCharacters = (text: string) =>
  text.replace(/\W/g, '');

export const getTypeName = (type: Type): string =>
  removeNonAlphanumericCharacters(stringifyType(type));

export function raise(error: string): never {
  throw new Error(error);
}

export function getNonExcludedReflectionClassProperties<T>(
  reflectionClass: ReflectionClass<T>,
): readonly ReflectionProperty[] {
  return reflectionClass
    .getProperties()
    .filter(
      property =>
        !excludedAnnotation.isExcluded(property.type, property.type.typeName!),
    );
}

export function getClassDecoratorMetadata<T>(
  classType: AbstractClassType<T>,
): GraphQLClassMetadata {
  const resolver = gqlClassDecorator._fetch(classType);
  if (!resolver) {
    throw new MissingResolverDecoratorError(classType);
  }
  return resolver;
}
