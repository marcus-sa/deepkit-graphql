import { graphql, Parent } from '@deepkit-graphql/core';

import { User } from '../types';
import { Database } from '../db';
import { PostRepository, UserRepository } from '../repositories';

export interface CreateUserArgs {
  readonly username: string;
}

@graphql.resolver<User>()
export class UserResolver {
  constructor(
    private readonly db: Database,
    private readonly user: UserRepository,
    private readonly post: PostRepository,
  ) {}

  @graphql.resolveField()
  async posts(parent: Parent<User>): Promise<User['posts']> {
    return await this.post.findByAuthor(parent);
  }

  @graphql.query()
  async getUser(id: User['id']): Promise<User> {
    return await this.user.findOne({ id });
  }

  @graphql.mutation()
  async createUser(data: CreateUserArgs): Promise<User> {
    return await this.user.create(data);
  }
}
