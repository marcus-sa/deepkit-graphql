import {
  isSameType,
  metaAnnotation,
  ReflectionKind,
  Type,
  TypeAnnotation,
  TypeLiteral,
  TypeObjectLiteral,
  typeOf,
} from '@deepkit/type';
// import {
//   GraphQLDirective,
//   GraphQLSkipDirective,
//   GraphQLIncludeDirective,
// } from 'graphql';
// import {
//   GraphQLDeferDirective,
//   GraphQLStreamDirective,
// } from '@graphql-tools/utils';

export const DIRECTIVE_META_NAME = 'directive';

export const FEDERATION_KEY_DIRECTIVE_NAME = 'key';

// export type Directive<
//   D extends GraphQLDirective | string,
//   A extends any[] = [],
// > = { __meta?: [typeof DIRECTIVE_META_NAME, D, A] };
//
// export type Defer = Directive<typeof GraphQLDeferDirective>;
//
// export type Stream = Directive<typeof GraphQLStreamDirective>;
//
// export type Skip = Directive<typeof GraphQLSkipDirective>;
//
// export type Include = Directive<typeof GraphQLIncludeDirective>;

// TODO: use jsdoc @deprecated instead
// export type Deprecated = Directive<'deprecated', { reason: string }>;

export interface FieldDirectiveOptions<Name extends string> {
  readonly name: Name;
}

export type FieldDirective<Name extends string> = TypeAnnotation<
  typeof DIRECTIVE_META_NAME,
  FieldDirectiveOptions<Name>
>;

export type FederationKey = FieldDirective<
  typeof FEDERATION_KEY_DIRECTIVE_NAME
>;

export function getMetaAnnotationDirectives(type: Type): Type[] | undefined {
  return metaAnnotation.getForName(type, DIRECTIVE_META_NAME);
}

export function hasMetaAnnotationDirective(
  annotations: readonly Type[],
  name: string,
): boolean {
  return annotations.some(
    annotation =>
      (annotation.typeArguments![0] as TypeLiteral).literal === name,
  );
}
