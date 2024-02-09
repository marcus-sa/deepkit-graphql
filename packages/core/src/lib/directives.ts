import {
  metaAnnotation,
  ReceiveType,
  ReflectionKind,
  resolveReceiveType,
  Type,
  TypeAnnotation,
  // TypeAnnotation,
  TypePropertySignature,
} from '@deepkit/type';
import { ClassType } from '@deepkit/core';
import { GraphQLDirective, DirectiveLocation, GraphQLSchema } from 'graphql';
import { GraphQLFieldConfig } from 'graphql/index';
import { GraphQLContext } from './types';
import { GraphQLFieldResolver } from 'graphql/type/definition';

export const DIRECTIVE_META_NAME = 'directive';

// TODO: Move to apollo package
export enum FederationDirective {
  KEY = 'key',
  SHAREABLE = 'shareable',
  INACCESSIBLE = 'inaccessible',
  OVERRIDE = 'override',
  EXTERNAL = 'external',
  REQUIRES = 'requires',
}

export const DIRECTIVE_OPTIONS_NAME_SYMBOL: unique symbol = Symbol('__name');

export interface DirectiveAnnotationOptions<N extends string> {
  readonly [DIRECTIVE_OPTIONS_NAME_SYMBOL]?: N;
}

export type DirectiveAnnotation<
  N extends string,
  O extends object = {},
> = TypeAnnotation<
  typeof DIRECTIVE_META_NAME,
  O & DirectiveAnnotationOptions<N>
>;

export interface DeprecatedOptions {
  readonly reason: string;
}

export type Deprecated<T extends DeprecatedOptions> = DirectiveAnnotation<
  'deprecated',
  T
>;

export type FederationKey = DirectiveAnnotation<FederationDirective.KEY>;

export type FederationReference<T> = {
  [K in keyof T as T[K] extends FederationKey ? K : never]: T[K];
};

export type FederationShareable<T = never> = T extends never
  ? DirectiveAnnotation<FederationDirective.SHAREABLE>
  : T & DirectiveAnnotation<FederationDirective.SHAREABLE>;

export type FederationInaccessible =
  DirectiveAnnotation<FederationDirective.INACCESSIBLE>;

export interface FederationOverrideOptions {
  readonly from: string;
  readonly label?: string;
}

export type FederationOverride<T extends FederationOverrideOptions> =
  DirectiveAnnotation<FederationDirective.OVERRIDE, T>;

export type FederationRequiresOptions = string[] | readonly string[];

export type FederationRequires<T extends FederationRequiresOptions> =
  DirectiveAnnotation<FederationDirective.REQUIRES, T>;

export type FederationExternal<T = never> = T extends never
  ? DirectiveAnnotation<FederationDirective.EXTERNAL>
  : T & DirectiveAnnotation<FederationDirective.EXTERNAL>;

export function getMetaAnnotationDirectives(type: Type): Type[] {
  return metaAnnotation.getForName(type, DIRECTIVE_META_NAME) || [];
}

export function hasMetaAnnotationDirective(
  annotations: readonly Type[],
  name: string,
): boolean {
  return annotations.some(annotation =>
    isMetaAnnotationDirective(annotation, name),
  );
}

export function isMetaAnnotationDirective(
  annotation: Type,
  name: string,
): boolean {
  return getMetaAnnotationDirectiveName(annotation) === name;
}

export function getMetaAnnotationDirectiveOptions(
  annotation: Type,
): readonly TypePropertySignature[] {
  if (annotation.kind !== ReflectionKind.objectLiteral) {
    throw new Error('This meta annotation directive does not support options');
  }

  return annotation.types
    .filter(isTypePropertySignature)
    .filter(type => !isTypeDirectiveOptionsNameSymbol(type));
}

export function isTypePropertySignature(
  type: Type,
): type is TypePropertySignature {
  return type.kind === ReflectionKind.propertySignature;
}

export function isTypeDirectiveOptionsNameSymbol(
  type: TypePropertySignature,
): boolean {
  return type.name === DIRECTIVE_OPTIONS_NAME_SYMBOL;
}

export function getMetaAnnotationDirectiveName(annotation: Type): string {
  const firstTypeArgument = annotation.typeArguments?.[0];
  if (firstTypeArgument?.kind === ReflectionKind.literal) {
    return String(firstTypeArgument.literal);
  }

  if (annotation.kind === ReflectionKind.objectLiteral) {
    const nameType = annotation.types
      .filter(isTypePropertySignature)
      .find(isTypeDirectiveOptionsNameSymbol);

    if (nameType?.type.kind === ReflectionKind.literal) {
      return String(nameType.type.literal);
    }
  }

  throw new Error('Unresolved meta annotation directive name');
}

export type ExtractTypeAnnotationOptions<
  T extends TypeAnnotation<string, any>,
> = Exclude<NonNullable<T['__meta']>, never>[1];

export interface GraphQLDirectiveTransformer<
  T extends DirectiveAnnotation<string>,
  Args = ExtractTypeAnnotationOptions<T>,
> {
  // transform(schema: GraphQLSchema, location: DirectiveLocation): Promise<GraphQLSchema | void> | GraphQLSchema | void;
  transformObjectField?(
    args: Args,
    fieldConfig: GraphQLFieldConfig<unknown, GraphQLContext>,
    schema: GraphQLSchema,
  ): GraphQLFieldResolver<unknown, GraphQLContext>;
}

export type InternalDirective<T extends DirectiveAnnotation<string>> =
  InternalGraphQLDirective & GraphQLDirectiveTransformer<T>;

export class Directives extends Set<ClassType<InternalDirective<any>>> {}

export class InternalGraphQLDirective extends GraphQLDirective {
  readonly __type: Type;
}

export function Directive<T extends DirectiveAnnotation<string>>(
  options: Pick<GraphQLDirective, 'locations'>,
  type?: ReceiveType<T>,
): ClassType<InternalDirective<T>> {
  type = resolveReceiveType(type);

  const name = getMetaAnnotationDirectiveName(type);

  const args = getMetaAnnotationDirectiveOptions(type);

  return class extends InternalGraphQLDirective {
    readonly __type = type as Type;

    constructor() {
      super({
        name,
        // TODO
        args: {},
        ...options,
      });
    }
  } as ClassType<InternalDirective<T>>;
}
