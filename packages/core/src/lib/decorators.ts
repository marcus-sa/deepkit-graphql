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
  PropertyDecoratorResult,
  ReceiveType,
  ReflectionClass,
  ReflectionKind,
  resolveReceiveType,
  resolveRuntimeType,
  Type,
  TypeClass,
  TypeObjectLiteral,
  UnionToIntersection,
} from '@deepkit/type';

import { requireTypeName, unwrapPromiseLikeType } from './types-builder';

export const typeResolvers = new Map<string, ClassType>();

/*export function isValidMethodReturnType(
  classType: ClassType,
  methodName: string,
): boolean {
  const resolverType = resolveRuntimeType(classType);
  const reflectionClass = ReflectionClass.from(resolverType);
  const method = reflectionClass.getMethod(methodName);
  let returnType = method.getReturnType();
  returnType = unwrapPromiseLikeType(returnType);

  return returnType.kind !== ReflectionKind.union
    ? returnType.kind === ReflectionKind.objectLiteral ||
        returnType.kind === ReflectionKind.class
    : returnType.types.some(
        type =>
          type.kind === ReflectionKind.objectLiteral ||
          type.kind === ReflectionKind.class ||
          type.kind === ReflectionKind.null ||
          type.kind === ReflectionKind.undefined,
      );
}*/

class GraphQLResolver {
  type?: TypeClass | TypeObjectLiteral;

  classType: ClassType;

  readonly mutations = new Map<string, GraphQLMutationMetadata>();

  readonly queries = new Map<string, GraphQLQueryMetadata>();

  readonly resolveFields = new Map<string, GraphQLFieldMetadata>();

  readonly checks = new Set<(decorator: GraphQLResolverDecorator) => void>();
}

class GraphQLResolverDecorator {
  t = new GraphQLResolver();

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

  addMutation(property: string, mutation: GraphQLMutationMetadata) {
    this.t.mutations.set(property, mutation);
  }

  addQuery(property: string, query: GraphQLQueryMetadata) {
    this.t.queries.set(property, query);
  }

  addResolveField(property: string, field: GraphQLFieldMetadata) {
    this.t.resolveFields.set(property, field);
  }

  addCheck(check: (decorator: GraphQLResolverDecorator) => void) {
    this.t.checks.add(check);
  }
}

interface GraphQLQueryOptions {
  description?: string;
  deprecationReason?: string;
}

export class GraphQLQueryMetadata implements GraphQLQueryOptions {
  name: string;
  classType: ClassType;
  description?: string;
  deprecationReason?: string;
  readonly checks = new Set<(decorator: GraphQLResolverDecorator) => void>();
}

class GraphQLQueryDecorator {
  t = new GraphQLQueryMetadata();

  onDecorator(classType: ClassType, property: string | undefined) {
    if (!property) return;
    this.t.name = property;
    this.t.classType = classType;
    gqlResolverDecorator.addQuery(property, this.t)(classType);

    this.t.checks.forEach(check =>
      gqlResolverDecorator.addCheck(check)(classType),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  query(options?: GraphQLQueryOptions) {
    this.t.description = options?.description;
    this.t.deprecationReason = options?.deprecationReason;

    /*this.t.checks.add(() => {
      if (!isValidMethodReturnType(this.t.classType, this.t.name)) {
        throw new Error(
          'Only classes and interfaces are supported as return types for methods decorated by @graphql.query()',
        );
      }
    });*/
  }
}

export const gqlQueryDecorator: PropertyDecoratorResult<
  typeof GraphQLQueryDecorator
> = createPropertyDecoratorContext(GraphQLQueryDecorator);

interface GraphQLMutationOptions {
  description?: string;
  deprecationReason?: string;
}

export class GraphQLMutationMetadata implements GraphQLMutationOptions {
  name: string;
  classType: ClassType;
  description?: string;
  deprecationReason?: string;
  readonly checks = new Set<(decorator: GraphQLResolverDecorator) => void>();
}

class GraphQLMutationDecorator {
  t = new GraphQLMutationMetadata();

  onDecorator(classType: ClassType, property: string | undefined) {
    if (!property) return;
    this.t.name = property;
    this.t.classType = classType;
    gqlResolverDecorator.addMutation(property, this.t)(classType);

    this.t.checks.forEach(check =>
      gqlResolverDecorator.addCheck(check)(classType),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  mutation(options?: GraphQLMutationOptions) {
    this.t.description = options?.description;
    this.t.deprecationReason = options?.deprecationReason;

    /*this.t.checks.add(() => {
      if (!isValidMethodReturnType(this.t.classType, this.t.name)) {
        throw new Error(
          'Only classes and interfaces are supported as return types for methods decorated by @graphql.mutation()',
        );
      }
    });*/
  }
}

export const gqlMutationDecorator: PropertyDecoratorResult<
  typeof GraphQLMutationDecorator
> = createPropertyDecoratorContext(GraphQLMutationDecorator);

export class GraphQLFieldMetadata {
  property: string;
  classType: ClassType;
  name: string;

  readonly checks = new Set<(decorator: GraphQLResolverDecorator) => void>();
}

class GraphQLFieldDecorator {
  t = new GraphQLFieldMetadata();

  onDecorator(classType: ClassType, property: string | undefined) {
    if (!property) return;
    this.t.property = property;
    this.t.name ||= property;
    this.t.classType = classType;
    gqlResolverDecorator.addResolveField(property, this.t)(classType);

    this.t.checks.forEach(check =>
      gqlResolverDecorator.addCheck(check)(classType),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  resolveField(name?: string) {
    if (name) {
      this.t.name = name;
    }

    this.t.checks.add(resolverDecorator => {
      if (!resolverDecorator.t.type) {
        throw new Error(
          'Can only resolve fields for resolvers with a type @graphql.resolver<T>()',
        );
      }

      const resolverType = resolveRuntimeType(this.t.classType);
      const reflectionClass = ReflectionClass.from(resolverType);

      if (!reflectionClass.hasMethod(this.t.name)) {
        const typeName = requireTypeName(resolverDecorator.t.type);
        throw new Error(
          `No field ${this.t.name} found on type ${typeName} for field resolver method ${this.t.property} on resolver ${this.t.classType.name}`,
        );
      }
    });
  }
}

export const gqlFieldDecorator: PropertyDecoratorResult<
  typeof GraphQLFieldDecorator
> = createPropertyDecoratorContext(GraphQLFieldDecorator);

//this workaround is necessary since generic functions (necessary for response<T>) are lost during a mapped type and changed ReturnType
// eslint-disable-next-line @typescript-eslint/ban-types
type GraphQLResolverFluidDecorator<T, D extends Function> = {
  [name in keyof T]: name extends 'resolver'
    ? <For>(type?: ReceiveType<For>) => D & GraphQLResolverFluidDecorator<T, D>
    : T[name] extends (...args: infer K) => any
    ? (...args: K) => D & GraphQLResolverFluidDecorator<T, D>
    : D &
        GraphQLResolverFluidDecorator<T, D> & { _data: ExtractApiDataType<T> };
};

type GraphQLResolverClassDecoratorResult = GraphQLResolverFluidDecorator<
  ExtractClass<typeof GraphQLResolverDecorator>,
  ClassDecoratorFn
> &
  DecoratorAndFetchSignature<typeof GraphQLResolverDecorator, ClassDecoratorFn>;

export const gqlResolverDecorator: GraphQLResolverClassDecoratorResult =
  createClassDecoratorContext(GraphQLResolverDecorator);

//this workaround is necessary since generic functions are lost during a mapped type and changed ReturnType
type GraphQLMerge<U> = {
  [K in keyof U]: K extends 'resolver'
    ? <For>(type?: ReceiveType<For>) => ClassDecoratorFn & U
    : U[K] extends (...a: infer A) => infer R
    ? R extends DualDecorator
      ? (...a: A) => ClassDecoratorFn & R & U
      : (...a: A) => R
    : never;
};

type MergedGraphQL<T extends any[]> = GraphQLMerge<
  Omit<UnionToIntersection<T[number]>, '_fetch' | 't'>
>;

export type GraphQLDecorator = ClassDecoratorFn &
  GraphQLResolverFluidDecorator<GraphQLResolverDecorator, ClassDecoratorFn>;

export type MergedGraphQLDecorator = Omit<
  MergedGraphQL<
    [
      typeof gqlResolverDecorator,
      typeof gqlFieldDecorator,
      typeof gqlMutationDecorator,
      typeof gqlQueryDecorator,
    ]
  >,
  'addMutation' | 'addQuery' | 'addResolveField' | 'onDecorator' | 'addCheck'
>;

// TODO: subscriptions
export const graphql: MergedGraphQLDecorator = mergeDecorator(
  gqlResolverDecorator,
  gqlFieldDecorator,
  gqlMutationDecorator,
  gqlQueryDecorator,
) as any as MergedGraphQLDecorator;
