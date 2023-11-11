import { graphql, Parent } from '@deepkit-graphql/core';

import { Post, User } from '../types';
import { Database } from '../db';
import { PostRepository, UserRepository } from '../repositories';

export interface CreatePostArgs {
  readonly title: string;
  readonly content: string;
}

@graphql.resolver<Post>()
export class PostResolver {
  constructor(
    private readonly db: Database,
    private readonly user: UserRepository,
    private readonly post: PostRepository,
  ) {}

  @graphql.resolveField()
  async author(parent: Parent<Post>): Promise<User> {
    return await this.user.findOneByPost(parent);
  }

  @graphql.query()
  async getPost(id: Post['id']): Promise<Post> {
    return await this.post.findOne({ id });
  }

  @graphql.mutation()
  async createPost(authorId: User['id'], data: CreatePostArgs): Promise<Post> {
    const author = await this.user.findOne({ id: authorId });

    return await this.post.create(author, data);
  }
}
