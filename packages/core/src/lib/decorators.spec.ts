import { graphql as executeGraphQL } from 'graphql';
import {
  assert,
  BackReference,
  cast,
  entity,
  integer,
  MinLength,
  PositiveNoZero,
  PrimaryKey,
  Reference,
  uuid,
  UUID,
} from '@deepkit/type';

import { graphql } from './decorators';
import { Context, Parent } from './types-builder';
import { buildSchema } from './schema-builder';
import { Resolvers } from './resolvers';

/*test('invalid return type for mutation', () => {
  expect(() => {
    @graphql.resolver()
    class TestResolver {
      @graphql.mutation()
      mutation(): string {
        return '';
      }
    }
  }).toThrowErrorMatchingSnapshot();
});*/

/*test('invalid return type for query', () => {
  expect(() => {
    @graphql.resolver()
    class TestResolver {
      @graphql.query()
      query(): string {
        return '';
      }
    }
  }).toThrowErrorMatchingSnapshot();
});*/

test('mutation', async () => {
  interface User {
    readonly id: integer & PositiveNoZero;
    readonly username: string;
  }

  interface CreateUserData {
    readonly username: string;
  }

  @graphql.resolver()
  class UserResolver {
    // eslint-disable-next-line @typescript-eslint/require-await
    @graphql.mutation({ description: 'Create user' })
    async createUser(data: CreateUserData): Promise<User | null> {
      return { id: 1, ...data };
    }
  }

  const resolvers = new Resolvers([new UserResolver()]);

  const schema = buildSchema({ resolvers });

  await expect(
    executeGraphQL({
      schema,
      source: `mutation { createUser(data: { username: "Test" }) { id } }`,
    }),
  ).resolves.toMatchSnapshot();
});

test('query', async () => {
  interface User {
    readonly id: integer & PositiveNoZero;
  }

  @graphql.resolver()
  class UserResolver {
    // eslint-disable-next-line @typescript-eslint/require-await
    @graphql.query()
    async getUser(id: User['id']): Promise<User | null> {
      return { id };
    }
  }

  const resolvers = new Resolvers([new UserResolver()]);

  const schema = buildSchema({ resolvers });

  await expect(
    executeGraphQL({
      schema,
      source: `{ getUser(id: 1) { id } }`,
      rootValue: {},
    }),
  ).resolves.toMatchSnapshot(); // Can't use .toMatchInlineSnapshot() because of decorators
});

test('mutation args validation', async () => {
  interface User {
    readonly username: string;
  }

  interface CreateUserData {
    readonly username: string & MinLength<6>;
  }

  @graphql.resolver()
  class UserResolver {
    // eslint-disable-next-line @typescript-eslint/require-await
    @graphql.mutation()
    async createUser(data: CreateUserData): Promise<User | null> {
      return data;
    }
  }

  const resolvers = new Resolvers([new UserResolver()]);

  const schema = buildSchema({ resolvers });

  await expect(
    executeGraphQL({
      source: `mutation { createUser(data: { username: "Test" }) { username } }`,
      schema,
    }),
  ).resolves.toMatchSnapshot(); // Can't use .toMatchInlineSnapshot() because of decorators
});

test('Context', async () => {
  interface TestCtx {
    readonly version: string;
  }

  const testCtx: TestCtx = {
    version: '1.0.0',
  };

  interface Info {
    readonly version: string;
  }

  @graphql.resolver()
  class TestResolver {
    @graphql.query()
    info(ctx: Context<TestCtx>): Info {
      expect(ctx).toBe(testCtx);
      return { version: ctx.version };
    }
  }

  const resolvers = new Resolvers([new TestResolver()]);

  const schema = buildSchema({ resolvers });

  await expect(
    executeGraphQL({
      contextValue: testCtx,
      source: `
        {
          info {
            version
          }
        }
      `,
      schema,
    }),
  ).resolves.toMatchSnapshot(); // Can't use .toMatchInlineSnapshot() because of decorators
});

describe('resolveField', () => {
  test('parent', async () => {
    @entity.name('post')
    class Post {
      readonly id: UUID & PrimaryKey = uuid();

      readonly author?: User & Reference;
    }

    @entity.name('user')
    class User {
      readonly id: UUID & PrimaryKey = uuid();
      readonly posts?: readonly Post[] & BackReference;
    }

    @graphql.resolver<Post>()
    class PostResolver {
      @graphql.resolveField()
      async author(post: Parent<Post>): Promise<User> {
        console.log(post);
        return cast<User>({});
      }
    }

    @graphql.resolver<User>()
    class UserResolver {
      @graphql.resolveField()
      posts(user: Parent<User>): readonly Post[] | undefined {
        assert<User>(user);
        return [];
      }

      @graphql.query()
      getUser(id: UUID): User {
        return cast<User>({ id });
      }
    }

    const resolvers = new Resolvers([new UserResolver(), new PostResolver()]);

    const schema = buildSchema({ resolvers });

    await expect(
      executeGraphQL({
        schema,
        source: `
          {
            getUser(id: "9f617521-b9c2-4ab9-a339-3c551c799027") {
              id
              posts {
                id
              }
            }
          }
        `,
      }),
    ).resolves.toMatchSnapshot();
  });

  test('resolves fields', async () => {
    interface Post {
      readonly id: UUID;
      readonly author?: User;
    }

    interface User {
      readonly id: UUID;
      readonly posts?: readonly Post[];
    }

    @graphql.resolver<User>()
    class UserResolver {
      @graphql.resolveField()
      posts(): readonly Post[] | undefined {
        return [cast<Post>({ id: '13fe73c3-af3d-4979-bc2d-f66ca1960a76' })];
      }

      @graphql.query()
      getUser(id: UUID): User {
        return cast<User>({ id });
      }
    }

    @graphql.resolver<Post>()
    class PostResolver {
      @graphql.resolveField()
      author(): User | undefined {
        return cast<User>({ id: '398cdf36-e3ac-475c-90aa-c70f99add874' });
      }
    }

    const resolvers = new Resolvers([new UserResolver(), new PostResolver()]);

    const schema = buildSchema({ resolvers });

    await expect(
      executeGraphQL({
        source: `
          {
            getUser(id: "398cdf36-e3ac-475c-90aa-c70f99add874") {
              id
              posts {
                id
                author {
                  id
                }
              }
            }
          }
        `,
        schema,
      }),
    ).resolves.toMatchSnapshot(); // Can't use .toMatchInlineSnapshot() because of decorators
  });

  // FIXME: only works when run alone
  /*test('resolver missing generic', () => {
    interface Post {
      readonly id: string;
      readonly author?: User;
    }

    interface User {
      readonly id: string;
      readonly posts?: readonly Post[];
    }

    expect(() => {
      @graphql.resolver()
      class UserResolver {
        @graphql.resolveField()
        posts(): readonly Post[] | null {
          return [];
        }
      }
    }).toThrowErrorMatchingSnapshot();
  });*/

  test('unknown property', () => {
    interface Post {
      readonly id: string;
      readonly author?: User;
    }

    interface User {
      readonly id: string;
      readonly posts?: readonly Post[];
    }

    expect(() => {
      @graphql.resolver<User>()
      class UserResolver {
        @graphql.resolveField('post')
        posts(): readonly Post[] | null {
          return [];
        }
      }
    }).toThrowErrorMatchingSnapshot();
  });
});
