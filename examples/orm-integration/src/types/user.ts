import type { Writable } from 'type-fest';
import {
  BackReference,
  entity,
  PrimaryKey,
  Unique,
  uuid,
  UUID,
} from '@deepkit/type';

import { Post } from './post';

@entity.name('user')
export class User {
  readonly id: UUID & PrimaryKey = uuid();

  readonly posts: readonly Post[] & BackReference = [];

  readonly createdAt: Date = new Date();

  constructor(readonly username: string & Unique) {}

  static create({ username }: Pick<User, 'username'>): User {
    return new User(username);
  }

  addPost(this: Writable<this>, post: Post): void {
    this.posts = [...this.posts, post];
  }
}
