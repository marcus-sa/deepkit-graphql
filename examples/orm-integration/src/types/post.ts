import { entity, PrimaryKey, Reference, uuid, UUID } from '@deepkit/type';

import { User } from './user';

@entity.name('post')
export class Post {
  readonly id: UUID & PrimaryKey = uuid();

  readonly createdAt: Date = new Date();

  constructor(
    readonly author: User & Reference,
    readonly title: string,
    readonly content: string,
  ) {}

  static create(
    author: User,
    { title, content }: Pick<Post, 'title' | 'content'>,
  ): Post {
    const post = new Post(author, title, content);
    author.addPost(post);
    return post;
  }
}
