import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLString,
  GraphQLUnionType,
  parse,
} from 'graphql';
import { InjectorContext } from '@deepkit/injector';
import {
  BrokerBus,
  BrokerBusChannel,
  BrokerMemoryAdapter,
} from '@deepkit/broker';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Excluded,
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
  ReflectionClass,
  ReflectionMethod, TypeClass, TypeObjectLiteral, typeOf,
  uuid,
  UUID,
} from '@deepkit/type';
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

import { TypesBuilder } from './types-builder';
import { GraphQLContext, ID } from './types';
import { Resolvers } from './resolvers';
import { isAsyncIterable } from './utils';
import { InvalidSubscriptionTypeError } from './errors';
import { Deprecated, FederationKey, FederationShareable, getMetaAnnotationDirectives } from './directives';
import { GraphQLPropertyType } from './decorators';

describe('TypesBuilder', () => {
  let builder: TypesBuilder;

  beforeEach(() => {
    builder = new TypesBuilder(new Resolvers([]));
  });

  // describe('createOutputObjectType', () => {});

  describe('createResolveFunction', () => {
    describe('given subscription', () => {
      it('works with Observable', async () => {
        class TestResolver {
          async subscribe(): Promise<Observable<string>> {
            return new BehaviorSubject('Observable');
          }
        }

        const injectorContext = InjectorContext.forProviders([TestResolver]);

        const resolver = { controller: TestResolver };

        const reflectionClass = ReflectionClass.from<TestResolver>();
        const reflectionMethod = reflectionClass.getMethod('subscribe');

        const resolve = (builder as TypesBuilder & any).createResolveFunction(
          resolver,
          reflectionMethod,
          [],
          GraphQLPropertyType.SUBSCRIPTION,
        );

        const asyncIterable: AsyncIterable<unknown> = await resolve(
          undefined,
          {},
          <GraphQLContext>{ injectorContext },
        );

        expect(isAsyncIterable(asyncIterable)).toBe(true);

        const asyncIterator = asyncIterable[Symbol.asyncIterator]();

        expect(await asyncIterator.next()).toStrictEqual({
          done: false,
          value: 'Observable',
        });
      });

      it('works with AsyncGenerator', async () => {
        class TestResolver {
          async *subscribe(): AsyncGenerator<string> {
            yield 'AsyncGenerator';
          }
        }

        const injectorContext = InjectorContext.forProviders([TestResolver]);

        const resolver = { controller: TestResolver };

        const reflectionClass = ReflectionClass.from<TestResolver>();
        const reflectionMethod = reflectionClass.getMethod('subscribe');

        const resolve = (builder as TypesBuilder & any).createResolveFunction(
          resolver,
          reflectionMethod,
          [],
          GraphQLPropertyType.SUBSCRIPTION,
        );

        const asyncIterable: AsyncIterable<unknown> = await resolve(
          undefined,
          {},
          <GraphQLContext>{ injectorContext },
        );

        expect(isAsyncIterable(asyncIterable)).toBe(true);

        const asyncIterator = asyncIterable[Symbol.asyncIterator]();

        expect(await asyncIterator.next()).toStrictEqual({
          done: false,
          value: 'AsyncGenerator',
        });
      });

      it('works with AsyncIterable', async () => {
        class TestResolver {
          subscribe(): AsyncIterable<string> {
            return {
              [Symbol.asyncIterator]() {
                return {
                  async next() {
                    return {
                      done: false,
                      value: 'AsyncIterable',
                    };
                  },
                };
              },
            };
          }
        }

        const injectorContext = InjectorContext.forProviders([TestResolver]);

        const resolver = { controller: TestResolver };

        const reflectionClass = ReflectionClass.from<TestResolver>();
        const reflectionMethod = reflectionClass.getMethod('subscribe');

        const resolve = (builder as TypesBuilder & any).createResolveFunction(
          resolver,
          reflectionMethod,
          [],
          GraphQLPropertyType.SUBSCRIPTION,
        );

        const asyncIterable: AsyncIterable<unknown> = await resolve(
          undefined,
          {},
          <GraphQLContext>{ injectorContext },
        );

        expect(isAsyncIterable(asyncIterable)).toBe(true);

        const asyncIterator = asyncIterable[Symbol.asyncIterator]();

        expect(await asyncIterator.next()).toStrictEqual({
          done: false,
          value: 'AsyncIterable',
        });
      });

      it('works with BrokerBus', async () => {
        const broker = new BrokerBus(new BrokerMemoryAdapter());

        type UserEvents = { type: 'user-created'; id: UUID };

        const channel = broker.channel<UserEvents>('user-events');

        class TestResolver {
          subscribe(): BrokerBusChannel<UserEvents> {
            return channel;
          }
        }

        const injectorContext = InjectorContext.forProviders([TestResolver]);

        const resolver = { controller: TestResolver };

        const reflectionClass = ReflectionClass.from<TestResolver>();
        const reflectionMethod = reflectionClass.getMethod('subscribe');

        const resolve = (builder as TypesBuilder & any).createResolveFunction(
          resolver,
          reflectionMethod,
          [],
          GraphQLPropertyType.SUBSCRIPTION,
        );

        const asyncIterable: AsyncIterable<unknown> = await resolve(
          undefined,
          {},
          <GraphQLContext>{ injectorContext },
        );

        expect(isAsyncIterable(asyncIterable)).toBe(true);

        const asyncIterator = asyncIterable[Symbol.asyncIterator]();

        const message = { type: 'user-created', id: uuid() } as const;

        await channel.publish(message);

        expect(await asyncIterator.next()).toStrictEqual({
          done: false,
          value: message,
        });
      });

      it('throws an error when return type of method is incorrect', () => {
        class TestResolver {
          subscribe() {}
        }

        const resolver = { controller: TestResolver };

        const reflectionClass = ReflectionClass.from<TestResolver>();
        const reflectionMethod = reflectionClass.getMethod('subscribe');

        expect(() =>
          (builder as TypesBuilder & any).createResolveFunction(
            resolver,
            reflectionMethod,
            [],
            GraphQLPropertyType.SUBSCRIPTION,
          ),
        ).toThrowError(InvalidSubscriptionTypeError);
      });
    });
  });

  describe('createObjectTypeDefinitionNode', () => {
    test('Deprecated annotation', () => {
      interface User {
        readonly id: ID;
        readonly oldField: string &
          Deprecated<{
            reason: 'oldField is deprecated. Use newField instead';
          }>;
        readonly newField: string;
      }

      const type = typeOf<User>() as TypeObjectLiteral;

      const definitionNode = parse(
        `
          type User {
            id: ID!
            oldField: String! @deprecated(reason: "oldField is deprecated. Use newField instead")
            newField: String!
          }
        `,
      ).definitions[0];

      expect(definitionNode).toMatchObject(
        builder.createObjectTypeDefinitionNode(type),
      );
    });

    describe('FederationShareable annotation', () => {
      test('object', () => {
        type Position = FederationShareable<{
          readonly x: integer;
          readonly y: integer;
        }>;

        const type = typeOf<Position>() as TypeObjectLiteral;

        const definitionNode = parse(
          `
          type Position @shareable {
            x: Int!
            y: Int!
          }
        `,
        ).definitions[0];

        expect(definitionNode).toMatchObject(
          builder.createObjectTypeDefinitionNode(type),
        );
      });

      test('field', () => {
        interface Position {
          readonly x: integer & FederationShareable;
          readonly y: integer & FederationShareable;
        }

        const type = typeOf<Position>() as TypeObjectLiteral;

        const definitionNode = parse(
          `
          type Position {
            x: Int! @shareable
            y: Int! @shareable
          }
        `,
        ).definitions[0];

        expect(definitionNode).toMatchObject(
          builder.createObjectTypeDefinitionNode(type),
        );
      });
    })

    test('FederationKey annotation', () => {
      interface User {
        readonly id: UUID & FederationKey;
        readonly name: string;
      }

      const type = typeOf<User>() as TypeObjectLiteral;

      const definitionNode = parse(
        `
          type User @key(fields: "id") {
            id: UUID!
            name: String!
          }
        `,
      ).definitions[0];

      expect(definitionNode).toMatchObject(
        builder.createObjectTypeDefinitionNode(type),
      );
    });
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

    const list = builder.createOutputType<
      readonly (Dog | Cat)[]
    >() as GraphQLList<GraphQLObjectType>;

    expect(list).toBeInstanceOf(GraphQLList);
    expect(list.ofType.toConfig()).toMatchInlineSnapshot(`
      {
        "astNode": undefined,
        "description": undefined,
        "extensionASTNodes": [],
        "extensions": {},
        "name": "DogCat",
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

  test('Promise return type', () => {
    // @ts-expect-error type only
    async function test(): Promise<string> {}

    const reflectionMethod = ReflectionMethod.from(test);
    const returnType = reflectionMethod.getReturnType();

    const type = builder.createReturnType(returnType);
    expect(type).toMatchInlineSnapshot(`"String!"`);
  });

  test('AsyncGenerator return type', () => {
    async function* test(): AsyncGenerator<string> {}

    const reflectionMethod = ReflectionMethod.from(test);
    const returnType = reflectionMethod.getReturnType();

    const type = builder.createReturnType(returnType);
    expect(type).toMatchInlineSnapshot(`"String!"`);
  });

  test('AsyncIterable return type', () => {
    // @ts-expect-error type only
    function test(): AsyncIterable<string> {}

    const reflectionMethod = ReflectionMethod.from(test);
    const returnType = reflectionMethod.getReturnType();

    const type = builder.createReturnType(returnType);
    expect(type).toMatchInlineSnapshot(`"String!"`);
  });

  test('Observable return type', () => {
    // @ts-expect-error type only
    function test(): Observable<string> {}

    const reflectionMethod = ReflectionMethod.from(test);
    const returnType = reflectionMethod.getReturnType();

    const type = builder.createReturnType(returnType);
    expect(type).toMatchInlineSnapshot(`"String!"`);
  });

  test('BrokerBusChannel return type', () => {
    type UserCreatedEvent = { readonly type: 'user-created'; readonly id: ID };

    // @ts-expect-error type only
    function test(): BrokerBusChannel<UserCreatedEvent> {}

    const reflectionMethod = ReflectionMethod.from(test);
    const returnType = reflectionMethod.getReturnType();

    const type = builder.createReturnType(returnType);
    expect(type).toMatchInlineSnapshot(`"UserCreatedEvent!"`);
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
          "astNode": {
            "description": undefined,
            "directives": [],
            "kind": "FieldDefinition",
            "name": {
              "kind": "Name",
              "value": "name",
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "String",
                },
              },
            },
          },
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
          "astNode": {
            "description": undefined,
            "directives": [],
            "kind": "FieldDefinition",
            "name": {
              "kind": "Name",
              "value": "one",
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "String",
                },
              },
            },
          },
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
          "astNode": {
            "description": undefined,
            "directives": [],
            "kind": "FieldDefinition",
            "name": {
              "kind": "Name",
              "value": "two",
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "String",
                },
              },
            },
          },
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
          "astNode": {
            "directives": [],
            "fields": [
              {
                "description": undefined,
                "directives": [],
                "kind": "FieldDefinition",
                "name": {
                  "kind": "Name",
                  "value": "type",
                },
                "type": {
                  "kind": "NonNullType",
                  "type": {
                    "kind": "NamedType",
                    "name": {
                      "kind": "Name",
                      "value": "String",
                    },
                  },
                },
              },
            ],
            "kind": "ObjectTypeDefinition",
            "name": {
              "kind": "Name",
              "value": "Cat",
            },
          },
          "description": undefined,
          "extensionASTNodes": [],
          "extensions": {},
          "fields": {
            "type": {
              "args": {},
              "astNode": {
                "description": undefined,
                "directives": [],
                "kind": "FieldDefinition",
                "name": {
                  "kind": "Name",
                  "value": "type",
                },
                "type": {
                  "kind": "NonNullType",
                  "type": {
                    "kind": "NamedType",
                    "name": {
                      "kind": "Name",
                      "value": "String",
                    },
                  },
                },
              },
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
          "astNode": {
            "directives": [],
            "fields": [
              {
                "description": undefined,
                "directives": [],
                "kind": "FieldDefinition",
                "name": {
                  "kind": "Name",
                  "value": "type",
                },
                "type": {
                  "kind": "NonNullType",
                  "type": {
                    "kind": "NamedType",
                    "name": {
                      "kind": "Name",
                      "value": "String",
                    },
                  },
                },
              },
            ],
            "kind": "ObjectTypeDefinition",
            "name": {
              "kind": "Name",
              "value": "Dog",
            },
          },
          "description": undefined,
          "extensionASTNodes": [],
          "extensions": {},
          "fields": {
            "type": {
              "args": {},
              "astNode": {
                "description": undefined,
                "directives": [],
                "kind": "FieldDefinition",
                "name": {
                  "kind": "Name",
                  "value": "type",
                },
                "type": {
                  "kind": "NonNullType",
                  "type": {
                    "kind": "NamedType",
                    "name": {
                      "kind": "Name",
                      "value": "String",
                    },
                  },
                },
              },
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

  test('excluded properties', () => {
    interface User {
      readonly id: string;
      readonly username: string;
      readonly password: string & Excluded;
    }

    const userObjectType =
      builder.createOutputType<User>() as GraphQLObjectType;

    expect(userObjectType.getFields()).toMatchInlineSnapshot(`
      {
        "id": {
          "args": [],
          "astNode": {
            "description": undefined,
            "directives": [],
            "kind": "FieldDefinition",
            "name": {
              "kind": "Name",
              "value": "id",
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "String",
                },
              },
            },
          },
          "deprecationReason": undefined,
          "description": undefined,
          "extensions": {},
          "name": "id",
          "resolve": undefined,
          "subscribe": undefined,
          "type": "String!",
        },
        "username": {
          "args": [],
          "astNode": {
            "description": undefined,
            "directives": [],
            "kind": "FieldDefinition",
            "name": {
              "kind": "Name",
              "value": "username",
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "String",
                },
              },
            },
          },
          "deprecationReason": undefined,
          "description": undefined,
          "extensions": {},
          "name": "username",
          "resolve": undefined,
          "subscribe": undefined,
          "type": "String!",
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
          "astNode": {
            "description": undefined,
            "directives": [],
            "kind": "FieldDefinition",
            "name": {
              "kind": "Name",
              "value": "id",
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "String",
                },
              },
            },
          },
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
          "astNode": {
            "description": undefined,
            "directives": [],
            "kind": "FieldDefinition",
            "name": {
              "kind": "Name",
              "value": "posts",
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "ListType",
                "type": {
                  "kind": "NonNullType",
                  "type": {
                    "kind": "NamedType",
                    "name": {
                      "kind": "Name",
                      "value": "Post",
                    },
                  },
                },
              },
            },
          },
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
          "astNode": {
            "description": undefined,
            "directives": [],
            "kind": "FieldDefinition",
            "name": {
              "kind": "Name",
              "value": "author",
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "User",
                },
              },
            },
          },
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
          "astNode": {
            "description": undefined,
            "directives": [],
            "kind": "FieldDefinition",
            "name": {
              "kind": "Name",
              "value": "id",
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "String",
                },
              },
            },
          },
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

  test.todo(
    'extends' /*, () => {
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
  }*/,
  );
});
