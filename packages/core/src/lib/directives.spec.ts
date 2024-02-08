import { integer, is, typeOf, uuid, UUID } from '@deepkit/type';

import { ID } from './types';
import {
  Deprecated,
  FederationDirective,
  FederationInaccessible,
  FederationKey,
  FederationOverride,
  FederationReference,
  FederationShareable,
  getMetaAnnotationDirectives,
  hasMetaAnnotationDirective,
} from './directives';

test('FederationReference', () => {
  interface User {
    id: UUID & FederationKey;
    name: string;
  }

  type FederatedUser = FederationReference<User>;

  expect(is<FederatedUser>({ id: uuid() })).toBe(true);

  // expect(is<FederatedUser>({ name: 'hello' })).toBe(false);
});

test('hasMetaAnnotationDirective', () => {
  const type = typeOf<string & FederationKey>();

  const annotations = getMetaAnnotationDirectives(type);
  expect(annotations).toBeDefined();

  expect(
    hasMetaAnnotationDirective(annotations!, FederationDirective.KEY),
  ).toBe(true);
});

test('FederationOverride', () => {
  interface Product {
    readonly id: ID & FederationKey;
    readonly inStock: boolean & FederationOverride<{ from: 'Products' }>;
  }
});

describe('FederationShareable', () => {
  test('object', () => {
    type Position = FederationShareable<{
      readonly x: integer;
      readonly y: integer;
    }>;

    const type = typeOf<Position>();

    console.log(type);

    const annotations = getMetaAnnotationDirectives(type);

    console.log(annotations);
  });

  test('field', () => {
    interface Position {
      readonly x: integer & FederationShareable;
      readonly y: integer & FederationShareable;
    }

    const type = typeOf<Position>();

    console.log(type);

    const annotations = getMetaAnnotationDirectives(type);

    console.log(annotations);
  });
});

test('FederationInaccessible', () => {
  type Position = FederationShareable<{
    readonly x: integer;
    readonly y: integer;
    readonly z: integer & FederationInaccessible;
  }>;

  const type = typeOf<Position>();

  console.log(type);
});

test('Deprecated', () => {
  interface MyType {
    readonly id: ID;
    readonly oldField: string &
      Deprecated<{ reason: 'oldField is deprecated. Use newField instead.' }>;
    readonly newField: string;
  }

  const type = typeOf<MyType>();

  console.log(type);
});
