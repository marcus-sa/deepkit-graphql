import { GraphQLEnumType, GraphQLID, GraphQLUnionType } from 'graphql';
import {
  float,
  float32,
  float64,
  int16,
  int32,
  int8,
  integer,
  Negative,
  NegativeNoZero,
  Positive,
  PositiveNoZero,
  ReflectionMethod,
  stringifyType,
  typeOf,
  UUID,
} from '@deepkit/type';
import {
  GraphQLBigInt,
  GraphQLByte,
  GraphQLNegativeFloat,
  GraphQLNegativeInt,
  GraphQLNonNegativeFloat,
  GraphQLNonNegativeInt,
  GraphQLNonPositiveFloat,
  GraphQLNonPositiveInt,
  GraphQLPositiveFloat,
  GraphQLPositiveInt,
  GraphQLDateTime,
  GraphQLUUID,
  GraphQLVoid,
} from 'graphql-scalars';
import {
  GraphQLList,
  GraphQLObjectType,
  GraphQLBoolean,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
} from 'graphql';

import { TypesBuilder, ID, getTypeName } from './types-builder';

describe('TypesBuilder', () => {
  let builder: TypesBuilder;

  beforeEach(() => {
    builder = new TypesBuilder();
  });

  test('ID', () => {
    const type = builder.createOutputType<ID>();
    expect(type).toBe(GraphQLID);
  });

  test('UUID', () => {
    const type = builder.createOutputType<UUID>();
    expect(type).toBe(GraphQLUUID);
  });

  test('union array', () => {
    interface Animal {
      readonly type: string;
    }

    interface Dog extends Animal {
      readonly type: 'dog';
    }

    interface Cat extends Animal {
      readonly type: 'cat';
    }

    type AnimalU = Dog | Cat;

    const list = builder.createOutputType<
      readonly AnimalU[]
    >() as GraphQLList<GraphQLObjectType>;

    expect(list).toBeInstanceOf(GraphQLList);
    expect(list.ofType.name).toEqual('AnimalU');
    expect(list.ofType.toConfig()).toMatchInlineSnapshot(`
          {
            "astNode": undefined,
            "description": undefined,
            "extensionASTNodes": [],
            "extensions": {},
            "name": "AnimalU",
            "resolveType": undefined,
            "types": [
              "Dog",
              "Cat",
            ],
          }
      `);
  });

  test('void', () => {
    const voidType = builder.createOutputType<void>() as typeof GraphQLVoid;

    expect(voidType).toBe(GraphQLVoid);
    expect(voidType.name).toEqual('Void');
  });

  test('undefined', () => {
    const voidType =
      builder.createOutputType<undefined>() as typeof GraphQLVoid;

    expect(voidType).toBe(GraphQLVoid);
    expect(voidType.name).toEqual('Void');
  });

  test('void return type', () => {
    function test(): void {}

    const reflectionMethod = ReflectionMethod.from(test);
    const returnType = reflectionMethod.getReturnType();

    const type = builder.createReturnType(returnType);
    expect(type).toBe(GraphQLVoid);
  });

  test('interface array', () => {
    interface User {
      readonly name: string;
    }

    const list = builder.createOutputType<
      readonly User[]
    >() as GraphQLList<GraphQLObjectType>;

    expect(list).toBeInstanceOf(GraphQLList);
    expect(list.ofType.name).toEqual('User');
    expect(list.ofType.getFields()).toMatchInlineSnapshot(`
      {
        "name": {
          "args": [],
          "astNode": undefined,
          "deprecationReason": undefined,
          "description": undefined,
          "extensions": {},
          "name": "name",
          "resolve": undefined,
          "subscribe": undefined,
          "type": "String!",
        },
      }
    `);
  });

  test('string', () => {
    const type = builder.createOutputType<string>();
    expect(type).toBe(GraphQLString);
  });

  test('boolean', () => {
    const type = builder.createOutputType<boolean>();
    expect(type).toBe(GraphQLBoolean);
  });

  test('int8', () => {
    const type = builder.createOutputType<int8>();
    expect(type).toBe(GraphQLInt);
  });

  test('int16', () => {
    const type = builder.createOutputType<int16>();
    expect(type).toBe(GraphQLInt);
  });

  test('int32', () => {
    const type = builder.createOutputType<int32>();
    expect(type).toBe(GraphQLInt);
  });

  test('integer', () => {
    const type = builder.createOutputType<integer>();
    expect(type).toBe(GraphQLInt);
  });

  test('integer & Positive', () => {
    const type = builder.createOutputType<integer & Positive>();
    expect(type).toBe(GraphQLNonNegativeInt);
  });

  test('integer & PositiveNoZero', () => {
    const type = builder.createOutputType<integer & PositiveNoZero>();
    expect(type).toBe(GraphQLPositiveInt);
  });

  test('integer & Negative', () => {
    const type = builder.createOutputType<integer & Negative>();
    expect(type).toBe(GraphQLNonPositiveInt);
  });

  test('integer & NegativeNoZero', () => {
    const type = builder.createOutputType<integer & NegativeNoZero>();
    expect(type).toBe(GraphQLNegativeInt);
  });

  test('float', () => {
    const type = builder.createOutputType<float>();
    expect(type).toBe(GraphQLFloat);
  });

  test('float & Positive', () => {
    const type = builder.createOutputType<float & Positive>();
    expect(type).toBe(GraphQLNonNegativeFloat);
  });

  test('float & PositiveNoZero', () => {
    const type = builder.createOutputType<float & PositiveNoZero>();
    expect(type).toBe(GraphQLPositiveFloat);
  });

  test('float & Negative', () => {
    const type = builder.createOutputType<float & Negative>();
    expect(type).toBe(GraphQLNonPositiveFloat);
  });

  test('float & NegativeNoZero', () => {
    const type = builder.createOutputType<float & NegativeNoZero>();
    expect(type).toBe(GraphQLNegativeFloat);
  });

  test('float32', () => {
    const type = builder.createOutputType<float32>();
    expect(type).toBe(GraphQLFloat);
  });

  test('float64', () => {
    const type = builder.createOutputType<float64>();
    expect(type).toBe(GraphQLFloat);
  });

  test('bigint', () => {
    const type = builder.createOutputType<bigint>();
    expect(type).toBe(GraphQLBigInt);
  });

  test('Date', () => {
    const type = builder.createOutputType<Date>();
    expect(type).toBe(GraphQLDateTime);
  });

  test('Uint8Array', () => {
    const type = builder.createOutputType<Uint8Array>();
    expect(type).toBe(GraphQLByte);
  });

  test('number', () => {
    expect(() =>
      builder.createOutputType<number>(),
    ).toThrowErrorMatchingInlineSnapshot(`"Add a decorator to type "number""`);
  });

  test('interface', () => {
    interface Test {
      readonly one: string;
      readonly two?: string;
    }

    const list = builder.createOutputType<Test>() as GraphQLObjectType;

    expect(list).toBeInstanceOf(GraphQLObjectType);
    expect(list.name).toEqual('Test');
    expect(list.getFields()).toMatchInlineSnapshot(`
          {
            "one": {
              "args": [],
              "astNode": undefined,
              "deprecationReason": undefined,
              "description": undefined,
              "extensions": {},
              "name": "one",
              "resolve": undefined,
              "subscribe": undefined,
              "type": "String!",
            },
            "two": {
              "args": [],
              "astNode": undefined,
              "deprecationReason": undefined,
              "description": undefined,
              "extensions": {},
              "name": "two",
              "resolve": undefined,
              "subscribe": undefined,
              "type": "String",
            },
          }
      `);
  });

  test('../../deepkit/deepkit-framework/dist', () => {
    interface Animal {
      readonly type: string;
    }

    interface Dog extends Animal {
      readonly type: 'dog';
    }

    interface Cat extends Animal {
      readonly type: 'cat';
    }

    const union = builder.createOutputType<Cat | Dog>() as GraphQLUnionType;

    expect(union.toConfig()).toMatchInlineSnapshot(`
          {
            "astNode": undefined,
            "description": undefined,
            "extensionASTNodes": [],
            "extensions": {},
            "name": "CatDog",
            "resolveType": undefined,
            "types": [
              "Cat",
              "Dog",
            ],
          }
      `);

    expect(union.getTypes().map(type => type.toConfig()))
      .toMatchInlineSnapshot(`
          [
            {
              "astNode": undefined,
              "description": undefined,
              "extensionASTNodes": [],
              "extensions": {},
              "fields": {
                "type": {
                  "args": {},
                  "astNode": undefined,
                  "deprecationReason": undefined,
                  "description": undefined,
                  "extensions": {},
                  "resolve": undefined,
                  "subscribe": undefined,
                  "type": "String!",
                },
              },
              "interfaces": [],
              "isTypeOf": undefined,
              "name": "Cat",
            },
            {
              "astNode": undefined,
              "description": undefined,
              "extensionASTNodes": [],
              "extensions": {},
              "fields": {
                "type": {
                  "args": {},
                  "astNode": undefined,
                  "deprecationReason": undefined,
                  "description": undefined,
                  "extensions": {},
                  "resolve": undefined,
                  "subscribe": undefined,
                  "type": "String!",
                },
              },
              "interfaces": [],
              "isTypeOf": undefined,
              "name": "Dog",
            },
          ]
      `);
  });

  test('enum', () => {
    enum Color {
      RED,
      BLUE,
    }

    const enumType = builder.createOutputType<Color>() as GraphQLEnumType;

    expect(enumType.toConfig()).toMatchInlineSnapshot(`
          {
            "astNode": undefined,
            "description": undefined,
            "extensionASTNodes": [],
            "extensions": {},
            "name": "Color",
            "values": {
              "BLUE": {
                "astNode": undefined,
                "deprecationReason": undefined,
                "description": undefined,
                "extensions": {},
                "value": 1,
              },
              "RED": {
                "astNode": undefined,
                "deprecationReason": undefined,
                "description": undefined,
                "extensions": {},
                "value": 0,
              },
            },
          }
      `);
  });

  test('circular references', () => {
    interface Post {
      readonly id: string;
      readonly author?: User;
    }

    interface User {
      readonly id: string;
      readonly posts?: readonly Post[];
    }

    const userObjectType =
      builder.createOutputType<User>() as GraphQLObjectType;

    expect(userObjectType.getFields()).toMatchInlineSnapshot(`
          {
            "id": {
              "args": [],
              "astNode": undefined,
              "deprecationReason": undefined,
              "description": undefined,
              "extensions": {},
              "name": "id",
              "resolve": undefined,
              "subscribe": undefined,
              "type": "String!",
            },
            "posts": {
              "args": [],
              "astNode": undefined,
              "deprecationReason": undefined,
              "description": undefined,
              "extensions": {},
              "name": "posts",
              "resolve": undefined,
              "subscribe": undefined,
              "type": "[Post]",
            },
          }
      `);

    const postObjectType =
      builder.createOutputType<Post>() as GraphQLObjectType;

    expect(postObjectType.getFields()).toMatchInlineSnapshot(`
          {
            "author": {
              "args": [],
              "astNode": undefined,
              "deprecationReason": undefined,
              "description": undefined,
              "extensions": {},
              "name": "author",
              "resolve": undefined,
              "subscribe": undefined,
              "type": "User",
            },
            "id": {
              "args": [],
              "astNode": undefined,
              "deprecationReason": undefined,
              "description": undefined,
              "extensions": {},
              "name": "id",
              "resolve": undefined,
              "subscribe": undefined,
              "type": "String!",
            },
          }
      `);
  });

  test.todo(
    'extends' /*, () => {
    class Produce {}

    class Fruit extends Produce {}

    class Vegetable extends Produce {}

    console.log(typeOf<Vegetable>());
  }*/,
  );

  test.todo(
    'implements' /*, () => {
    class Produce {}

    class Fruit extends Produce {}

    class Vegetable extends Produce {}

    console.log(typeOf<Vegetable>());
  }*/,
  );

  test('extends', () => {
    interface Produce {
      readonly type: string;
      readonly test: string;
    }

    interface Fruit extends Produce {
      readonly type: 'fruit';
    }

    interface Vegetable extends Produce {
      readonly type: 'vegetable';
    }

    console.log(typeOf<Vegetable>());
  });
});

describe('getTypeName', () => {
  test('union', () => {
    interface Animal {
      readonly type: string;
    }

    interface Dog extends Animal {
      readonly type: 'dog';
    }

    interface Cat extends Animal {
      readonly type: 'cat';
    }

    expect(getTypeName(typeOf<Dog | Cat>())).toMatchInlineSnapshot(`"DogCat"`);
  });

  test('Pick', async () => {
    interface Test {
      readonly id: integer;
      readonly username: string;
    }

    expect(getTypeName(typeOf<Pick<Test, 'id'>>())).toMatchInlineSnapshot(
      `"PickTestid"`,
    );
  });

  test('generic interface', async () => {
    interface Test2<T> {
      readonly name: T;
    }

    expect(
      stringifyType(typeOf<Test2<'deepkit'>>()).replace(/\W/g, ''),
    ).toMatchInlineSnapshot(`"Test2deepkit"`);
  });
});
