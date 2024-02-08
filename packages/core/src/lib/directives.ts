import {
  metaAnnotation,
  ReflectionKind,
  Type,
  TypeAnnotation,
  TypePropertySignature,
} from '@deepkit/type';

export const DIRECTIVE_META_NAME = 'directive';

export const DIRECTIVE_DEPRECATED_NAME = 'deprecated';

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

export interface DirectiveOptions<N extends string> {
  readonly [DIRECTIVE_OPTIONS_NAME_SYMBOL]: N;
}

export type Directive<N extends string> = TypeAnnotation<
  typeof DIRECTIVE_META_NAME,
  DirectiveOptions<N>
>;

export interface DeprecatedOptions {
  readonly reason: string;
}

export type Deprecated<T extends DeprecatedOptions> = TypeAnnotation<
  typeof DIRECTIVE_META_NAME,
  DirectiveOptions<typeof DIRECTIVE_DEPRECATED_NAME> & T
>;

export type FederationKey = Directive<typeof FederationDirective.KEY>;

export type FederationReference<T> = {
  [K in keyof T as T[K] extends FederationKey ? K : never]: T[K];
};

export type FederationShareable<T = never> = T extends never
  ? Directive<typeof FederationDirective.SHAREABLE>
  : T & Directive<typeof FederationDirective.SHAREABLE>;

export type FederationInaccessible = Directive<
  typeof FederationDirective.INACCESSIBLE
>;

export interface FederationOverrideOptions {
  // readonly from: string | ClassType | Record<string, unknown>;
  readonly from: string;
  readonly label?: string;
}

export type FederationOverride<T extends FederationOverrideOptions> =
  TypeAnnotation<
    typeof DIRECTIVE_META_NAME,
    DirectiveOptions<typeof FederationDirective.OVERRIDE> & T
  >;

export type FederationRequires<T extends string[] | readonly string[]> =
  TypeAnnotation<
    typeof DIRECTIVE_META_NAME,
    DirectiveOptions<typeof FederationDirective.REQUIRES> & T
  >;

export type FederationExternal<T = never> = T extends never
  ? Directive<typeof FederationDirective.EXTERNAL>
  : T & Directive<typeof FederationDirective.EXTERNAL>;

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
