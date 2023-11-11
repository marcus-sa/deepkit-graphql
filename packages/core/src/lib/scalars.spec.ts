import { Kind, StringValueNode } from 'graphql';

import { DateTime } from './scalars';

describe('transformScalar', () => {
  test('DateTime', () => {
    expect(
      DateTime.serialize(new Date(`2023-10-12T08:11:34.553Z`)),
    ).toMatchInlineSnapshot(`2023-10-12T08:11:34.553Z`);
    expect(
      DateTime.parseValue(new Date(`2023-10-12T08:11:34.553Z`)),
    ).toMatchInlineSnapshot(`2023-10-12T08:11:34.553Z`);
    expect(
      DateTime.parseLiteral({
        kind: Kind.STRING,
        value: `2023-10-12T08:11:34.553Z`,
      } as StringValueNode),
    ).toMatchInlineSnapshot(`"2023-10-12T08:11:34.553Z"`);
  });
});
