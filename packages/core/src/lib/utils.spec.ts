import { integer, typeOf } from '@deepkit/type';

import { getTypeName } from './utils';

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

  test.todo('intersection');

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

    expect(getTypeName(typeOf<Test2<'deepkit'>>())).toMatchInlineSnapshot(
      `"Test2deepkit"`,
    );
  });
});
