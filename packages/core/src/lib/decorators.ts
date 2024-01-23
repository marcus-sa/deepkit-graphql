/* eslint-disable functional/immutable-data,functional/prefer-readonly-type,@typescript-eslint/typedef */
import { ClassType } from '@deepkit/core';
import {
  ClassDecoratorFn,
  createClassDecoratorContext,
  createPropertyDecoratorContext,
  DecoratorAndFetchSignature,
  DualDecorator,
  ExtractApiDataType,
  ExtractClass,
  mergeDecorator,
  PropertyDecoratorFn,
  PropertyDecoratorResult,
  ReceiveType,
  reflect,
  ReflectionClass,
  ReflectionKind,
  resolveReceiveType,
  TypeClass,
  TypeObjectLiteral,
  UnionToIntersection,
} from '@deepkit/type';

import { requireTypeName } from './utils';
import { InternalMiddleware } from './types';

export const typeResolvers = new Map<string, ClassType<unknown>>();

export class GraphQLClassMetadata {
  type?: TypeClass | TypeObjectLiteral;
  classType: ClassType;
  middleware: ReadonlySet<InternalMiddleware> = new Set<InternalMiddleware>();
  readonly mutations = new Map<string, GraphQLPropertyMetadata>();
  readonly queries = new Map<string, GraphQLPropertyMetadata>();
  readonly resolveFields = new Map<string, GraphQLPropertyMetadata>();
  readonly subscriptions = new Map<string, GraphQLPropertyMetadata>();
  readonly checks = new Set<(decorator: GraphQLClassDecorator) => void>();
}

export class GraphQLClassDecorator {
  t = new GraphQLClassMetadata();

  onDecorator(classType: ClassType) {
    this.t.classType = classType;
  }

  resolver<T>(type?: ReceiveType<T>) {
    try {
      type = resolveReceiveType(type);
      if (
        type.kind !== ReflectionKind.class &&
        type.kind !== ReflectionKind.objectLiteral
      ) {
        throw new Error(
          'Only classes and interfaces are supported by @graphql.resolver<T>()',
        );
      }
      this.t.type = type;
      const typeName = requireTypeName(type);
      typeResolvers.set(typeName, this.t.classType);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message !==
          'No type information received. Is deepkit/type correctly installed?'
      ) {
        throw err;
      }
    }

    this.t.checks.forEach(check => check(this));
  }

  addMutation(property: string, metadata: GraphQLPropertyMetadata) {
    this.t.mutations.set(property, metadata);
  }

  addQuery(property: string, metadata: GraphQLPropertyMetadata) {
    this.t.queries.set(property, metadata);
  }

  addSubscription(property: string, metadata: GraphQLPropertyMetadata) {
    this.t.subscriptions.set(property, metadata);
  }

  addResolveField(property: string, metadata: GraphQLPropertyMetadata) {
    this.t.resolveFields.set(property, metadata);
  }

  addCheck(check: (decorator: GraphQLClassDecorator) => void) {
    this.t.checks.add(check);
  }

  // eslint-disable-next-line functional/prefer-readonly-type
  middleware(...middleware: InternalMiddleware[]) {
    this.t.middleware = new Set(middleware);
  }
}

interface GraphQLQueryOptions {
  name?: string;
  description?: string;
  deprecationReason?: string;
}

interface GraphQLSubscriptionOptions {
  name?: string;
  description?: string;
  deprecationReason?: string;
}

interface GraphQLMutationOptions {
  name?: string;
  description?: string;
  deprecationReason?: string;
}

interface GraphQLResolveFieldOptions {
  name?: string;
  description?: string;
  deprecationReason?: string;
}

export class GraphQLPropertyMetadata implements GraphQLQueryOptions {
  name: string;
  property: string;
  classType: ClassType;
  middleware: Set<InternalMiddleware> = new Set<InternalMiddleware>();
  type: 'query' | 'mutation' | 'subscription' | 'resolveField';
  // TODO
  // returnType: Type;
  description?: string;
  deprecationReason?: string;
  readonly checks = new Set<(decorator: GraphQLClassDecorator) => void>();
}

class GraphQLPropertyDecorator {
  t = new GraphQLPropertyMetadata();

  onDecorator(classType: ClassType, property: string | undefined) {
    if (!property) return;
    this.t.property = property;
    this.t.name ||= property;
    this.t.classType = classType;

    gqlClassDecorator.addCheck(() => {
      switch (this.t.type) {
        case 'mutation':
          gqlClassDecorator.addMutation(property, this.t)(classType);
          break;

        case 'query':
          gqlClassDecorator.addQuery(property, this.t)(classType);
          break;

        case 'resolveField':
          gqlClassDecorator.addResolveField(property, this.t)(classType);
          break;

        case 'subscription':
          gqlClassDecorator.addSubscription(property, this.t)(classType);
          break;

        default:
          throw new Error('Invalid type');
      }
    })(classType);

    this.t.checks.forEach(check => {
      gqlClassDecorator.addCheck(check)(classType);
    });
  }

  query(options?: GraphQLQueryOptions) {
    if (options?.name) {
      this.t.name = options.name;
    }
    this.t.type = 'query';
    this.t.description = options?.description;
    this.t.deprecationReason = options?.deprecationReason;
  }

  mutation(options?: GraphQLMutationOptions) {
    if (options?.name) {
      this.t.name = options.name;
    }
    this.t.type = 'mutation';
    this.t.description = options?.description;
    this.t.deprecationReason = options?.deprecationReason;
  }

  subscription(options?: GraphQLSubscriptionOptions) {
    if (options?.name) {
      this.t.name = options.name;
    }
    this.t.type = 'subscription';
    this.t.description = options?.description;
    this.t.deprecationReason = options?.deprecationReason;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  resolveField(options?: GraphQLResolveFieldOptions) {
    if (options?.name) {
      this.t.name = options.name;
    }
    this.t.type = 'resolveField';
    this.t.description = options?.description;
    this.t.deprecationReason = options?.deprecationReason;

    this.t.checks.add(resolverDecorator => {
      if (!resolverDecorator.t.type) {
        throw new Error(
          'Can only resolve fields for resolvers with a type @graphql.resolver<T>()',
        );
      }

      const resolverType = reflect(this.t.classType);
      const reflectionClass = ReflectionClass.from(resolverType);

      if (!reflectionClass.hasMethod(this.t.name)) {
        const typeName = requireTypeName(resolverDecorator.t.type);
        throw new Error(
          `No field ${this.t.name} found on type ${typeName} for field resolver method ${this.t.property} on resolver ${this.t.classType.name}`,
        );
      }
    });
  }

  // eslint-disable-next-line functional/prefer-readonly-type
  middleware(...middleware: InternalMiddleware[]) {
    this.t.middleware = new Set(middleware);
  }
}

export const gqlPropertyDecorator: PropertyDecoratorResult<
  typeof GraphQLPropertyDecorator
> = createPropertyDecoratorContext(GraphQLPropertyDecorator);

// this workaround is necessary since generic functions (necessary for response<T>) are lost during a mapped type and changed ReturnType
// eslint-disable-next-line @typescript-eslint/ban-types
type GraphQLClassFluidDecorator<T, D extends Function> = {
  [name in keyof T]: name extends 'resolver'
    ? <For>(type?: ReceiveType<For>) => D & GraphQLClassFluidDecorator<T, D>
    : T[name] extends (...args: infer K) => any
    ? (...args: K) => D & GraphQLClassFluidDecorator<T, D>
    : D & GraphQLClassFluidDecorator<T, D> & { _data: ExtractApiDataType<T> };
};

type GraphQLClassDecoratorResult = GraphQLClassFluidDecorator<
  ExtractClass<typeof GraphQLClassDecorator>,
  ClassDecoratorFn
> &
  DecoratorAndFetchSignature<typeof GraphQLClassDecorator, ClassDecoratorFn>;

export const gqlClassDecorator: GraphQLClassDecoratorResult =
  createClassDecoratorContext(GraphQLClassDecorator);

//this workaround is necessary since generic functions are lost during a mapped type and changed ReturnType
type GraphQLMerge<U> = {
  [K in keyof U]: K extends 'resolver'
    ? <For>(
        type?: ReceiveType<For>,
      ) => (PropertyDecoratorFn | ClassDecoratorFn) & U
    : U[K] extends (...a: infer A) => infer R
    ? R extends DualDecorator
      ? (...a: A) => (PropertyDecoratorFn | ClassDecoratorFn) & R & U
      : (...a: A) => R
    : never;
};

type MergedGraphQL<T extends any[]> = GraphQLMerge<
  Omit<UnionToIntersection<T[number]>, '_fetch' | 't'>
>;

export type MergedGraphQLDecorator = Omit<
  MergedGraphQL<[typeof gqlClassDecorator, typeof gqlPropertyDecorator]>,
  | 'addMutation'
  | 'addQuery'
  | 'addResolveField'
  | 'addSubscription'
  | 'onDecorator'
  | 'addCheck'
>;

export const graphql: MergedGraphQLDecorator = mergeDecorator(
  gqlClassDecorator,
  gqlPropertyDecorator,
) as any as MergedGraphQLDecorator;
