import { PostRepository } from './post.repository';
import { Database, MemoryDatabaseAdapter } from '@deepkit/orm';

import { Post, User } from '../types';

describe('PostRepository', () => {
  describe('create', () => {
    it('succeeds', async () => {
      const db = new Database(new MemoryDatabaseAdapter());

      // @ts-ignore
      const postRepository = new PostRepository(db);

      const author = new User('Test');

      await db.persist(author);

      await expect(
        postRepository.create(author, {
          title: 'Test',
          content: 'Test',
        }),
      ).resolves.toBeInstanceOf(Post);
    });
  });

  it('errors', async () => {
    const db = new Database(new MemoryDatabaseAdapter());

    // @ts-ignore
    const postRepository = new PostRepository(db);

    let author = new User('Test');

    await db.persist(author);

    author = await db.query(User).filter({ id: author.id }).findOne();

    await expect(
      postRepository.create(author, {
        title: 'Test',
        content: 'Test',
      }),
    ).rejects.toMatchInlineSnapshot(
      `[Error: BackReference User.posts was not populated. Use joinWith(), useJoinWith(), etc to populate the reference.]`,
    );
  });
});
