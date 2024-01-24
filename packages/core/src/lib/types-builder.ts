import { asyncOperation, ClassType, isClass } from '@deepkit/core';
import { InjectorContext } from '@deepkit/injector';
import { BrokerBusChannel } from '@deepkit/broker';
import { map, Observable } from 'rxjs';
import { observableToAsyncIterable } from '@graphql-tools/utils';
import { TypeNumberBrand } from '@deepkit/type-spec';
import {
  deserializeFunction,
  ReceiveType,
  reflect,
  ReflectionClass,
  ReflectionKind,
  ReflectionMethod,
  ReflectionParameter,
  resolveReceiveType,
  serializeFunction,
  serializer,
  Type,
  TypeArray,
  TypeClass,
  TypeEnum,
  TypeObjectLiteral,
  TypePropertySignature,
  TypeUnion,
  validateFunction,
  ValidationError,
} from '@deepkit/type';
import {
  GraphQLEnumType,
  GraphQLEnumValueConfigMap,
  GraphQLError,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLFieldResolver,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLList,
  GraphQLNamedInputType,
  GraphQLNamedOutputType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLUnionType,
} from 'graphql';

import { Context, GraphQLContext, GraphQLFields, Instance, InternalMiddleware } from './types';
import { typeResolvers } from './decorators';
import { Resolver, Resolvers } from './resolvers';
import { InvalidSubscriptionTypeError, TypeNameRequiredError } from './errors';
import {
  BigInt,
  Boolean,
  Byte,
  DateTime,
  Float,
  ID as GraphQLID,
  Int,
  NegativeFloat,
  NegativeInt,
  NonNegativeFloat,
  NonNegativeInt,
  NonPositiveFloat,
  NonPositiveInt,
  PositiveFloat,
  PositiveInt,
  String,
  UUID,
  Void,
} from './scalars';
import {
  excludeNullAndUndefinedTypes,
  filterReflectionParametersMetaAnnotationsForArguments,
  getClassDecoratorMetadata,
  getNonExcludedReflectionClassProperties,
  getParentMetaAnnotationReflectionParameterIndex,
  getTypeName,
  isAsyncIterable,
  maybeUnwrapPromiseLikeType,
  maybeUnwrapSubscriptionReturnType,
  requireTypeName,
  transformAsyncIteratorResult,
} from './utils';

export class TypesBuilder {
  private readonly outputObjectTypes = new Map<string, GraphQLObjectType>();

  private readonly enumTypes = new WeakMap<TypeEnum, GraphQLEnumType>();

  private readonly unionTypes = new WeakMap<TypeUnion, GraphQLUnionType>();

  private readonly inputObjectTypes = new Map<string, GraphQLInputObjectType>();

  constructor(private readonly resolvers: Resolvers) {}

  getScalarType(type: Type): GraphQLScalarType {
    if (type.typeName === 'ID') return GraphQLID;

    switch (type.kind) {
      case ReflectionKind.boolean:
        return Boolean;

      case ReflectionKind.class:
        return this.getScalarTypeForClass(type);

      case ReflectionKind.undefined:
      case ReflectionKind.void:
        return Void;

      case ReflectionKind.bigint:
        return BigInt;

      case ReflectionKind.number: {
        const hasPositiveNoZeroDecorator = type.decorators?.find(
          decorator => decorator.typeName === 'PositiveNoZero',
        );
        const hasPositiveDecorator = type.decorators?.find(
          decorator => decorator.typeName === 'Positive',
        );
        const hasNegativeNoZeroDecorator = type.decorators?.find(
          decorator => decorator.typeName === 'NegativeNoZero',
        );
        const hasNegativeDecorator = type.decorators?.find(
          decorator => decorator.typeName === 'Negative',
        );

        if (
          type.brand === TypeNumberBrand.float ||
          type.brand === TypeNumberBrand.float32 ||
          type.brand === TypeNumberBrand.float64
        ) {
          if (hasPositiveNoZeroDecorator) return PositiveFloat;
          if (hasNegativeNoZeroDecorator) return NegativeFloat;
          if (hasNegativeDecorator) return NonPositiveFloat;
          if (hasPositiveDecorator) return NonNegativeFloat;
          return Float;
        }

        if (
          type.brand === TypeNumberBrand.uint8 ||
          type.brand === TypeNumberBrand.uint16 ||
          type.brand === TypeNumberBrand.uint32
        ) {
          return PositiveInt;
        }

        if (
          type.brand === TypeNumberBrand.integer ||
          type.brand === TypeNumberBrand.int8 ||
          type.brand === TypeNumberBrand.int16 ||
          type.brand === TypeNumberBrand.int32
        ) {
          if (hasPositiveNoZeroDecorator) return PositiveInt;
          if (hasNegativeNoZeroDecorator) return NegativeInt;
          if (hasNegativeDecorator) return NonPositiveInt;
          if (hasPositiveDecorator) return NonNegativeInt;
          return Int;
        }

        throw new Error(`Add a decorator to type "number"`);
      }

      case ReflectionKind.literal:
        return String;

      case ReflectionKind.string:
        if (type.typeName === 'UUID') return UUID;
        return String;

      default:
        throw new Error(`Kind ${type.kind} is not supported`);
    }
  }

  createEnumType(type: TypeEnum): GraphQLEnumType {
    if (this.enumTypes.has(type)) {
      return this.enumTypes.get(type)!;
    }

    if (!type.typeName) {
      throw new TypeNameRequiredError(type);
    }

    const enumType = new GraphQLEnumType({
      name: type.typeName,
      // TODO
      // description: '',
      // TODO
      // deprecationReason: '',
      values: Object.entries(type.enum).reduce<GraphQLEnumValueConfigMap>(
        (values, [key, value]) => ({
          [key]: { value },
          ...values,
        }),
        {},
      ),
    });
    this.enumTypes.set(type, enumType);

    return enumType;
  }

  createUnionType(type: TypeUnion): GraphQLUnionType {
    if (this.unionTypes.has(type)) {
      return this.unionTypes.get(type)!;
    }

    const typesWithoutNullAndUndefined = excludeNullAndUndefinedTypes(
      type.types,
    );

    const types = typesWithoutNullAndUndefined.map(type => {
      if (
        type.kind !== ReflectionKind.class &&
        type.kind !== ReflectionKind.objectLiteral
      ) {
        throw new Error('Only classes and interfaces are supported for unions');
      }

      return this.createOutputObjectType(type);
    });

    const unionType = new GraphQLUnionType({
      name: getTypeName(type),
      // TODO
      // description: '',
      // TODO
      // deprecationReason: '',
      types,
    });
    this.unionTypes.set(type, unionType);

    return unionType;
  }

  createInputListType(type: TypeArray): GraphQLList<GraphQLInputType> {
    const listType = this.createInputType(type.type);
    return new GraphQLList(listType);
  }

  createOutputListType<T extends GraphQLOutputType>(
    type: TypeArray,
  ): GraphQLList<GraphQLOutputType> {
    const listType = this.createOutputType(type.type);
    return new GraphQLList(listType);
  }

  getScalarTypeForClass(type: TypeClass): GraphQLScalarType {
    switch (type.classType.name) {
      case Date.name:
        return DateTime;

      case ArrayBuffer.name:
      case Uint8Array.name:
        return Byte;

      default:
        throw new Error(
          `${type.classType.name} is not a supported scalar type`,
        );
    }
  }

  createNamedInputType<T>(type?: ReceiveType<T>): GraphQLNamedInputType {
    type = resolveReceiveType(type);

    if (type.typeName === 'ID') return GraphQLID;

    switch (type.kind) {
      case ReflectionKind.propertySignature:
        return this.createNamedInputType(type.type);

      case ReflectionKind.objectLiteral:
        return this.createNamedInputType(type);

      case ReflectionKind.class: {
        try {
          return this.getScalarTypeForClass(type);
        } catch {
          return this.createNamedInputType(type);
        }
      }

      case ReflectionKind.enum:
        return this.createEnumType(type);

      default:
        return this.getScalarType(type);
    }
  }

  createInputType<T>(type?: ReceiveType<T>): GraphQLInputType {
    type = resolveReceiveType(type);

    if (type.typeName === 'ID') return GraphQLID;

    switch (type.kind) {
      case ReflectionKind.propertySignature:
        return this.createInputType(type.type);

      case ReflectionKind.objectLiteral:
        return this.createInputObjectType(type);

      case ReflectionKind.class: {
        try {
          return this.getScalarTypeForClass(type);
        } catch {
          return this.createInputObjectType(type);
        }
      }

      case ReflectionKind.array:
        return this.createInputListType(type);

      case ReflectionKind.enum:
        return this.createEnumType(type);

      default:
        return this.getScalarType(type);
    }
  }

  createNamedOutputType<T>(type?: ReceiveType<T>): GraphQLNamedOutputType {
    type = resolveReceiveType(type);

    if (type.typeName === 'ID') return GraphQLID;

    switch (type.kind) {
      case ReflectionKind.union: {
        const typesWithoutNullAndUndefined = excludeNullAndUndefinedTypes(
          type.types,
        );

        if (typesWithoutNullAndUndefined.length === 1) {
          return this.createNamedOutputType(typesWithoutNullAndUndefined[0]);
        }

        return this.createUnionType(type);
      }

      case ReflectionKind.propertySignature:
        return this.createNamedOutputType(type.type);

      case ReflectionKind.objectLiteral:
        return this.createOutputObjectType(type);

      case ReflectionKind.class: {
        try {
          return this.getScalarTypeForClass(type);
        } catch {
          return this.createOutputObjectType(type);
        }
      }

      case ReflectionKind.enum:
        return this.createEnumType(type);

      default:
        return this.getScalarType(type);
    }
  }

  createOutputType<T>(type?: ReceiveType<T>): GraphQLOutputType {
    type = resolveReceiveType(type);

    if (type.typeName === 'ID') return GraphQLID;

    switch (type.kind) {
      case ReflectionKind.union: {
        const typesWithoutNullAndUndefined = excludeNullAndUndefinedTypes(
          type.types,
        );

        if (typesWithoutNullAndUndefined.length === 1) {
          return this.createOutputType(typesWithoutNullAndUndefined[0]);
        }

        return this.createUnionType(type);
      }

      case ReflectionKind.propertySignature:
        return this.createOutputType(type.type);

      case ReflectionKind.objectLiteral:
        return this.createOutputObjectType(type);

      case ReflectionKind.class: {
        try {
          return this.getScalarTypeForClass(type);
        } catch {
          return this.createOutputObjectType(type);
        }
      }

      case ReflectionKind.array:
        return this.createOutputListType(type);

      case ReflectionKind.enum:
        return this.createEnumType(type);

      default:
        return this.getScalarType(type);
    }
  }

  getResolver<T>(type: TypeClass | TypeObjectLiteral): Resolver<T> | undefined {
    const typeName = requireTypeName(type);
    const controllerClassType = typeResolvers.get(typeName);
    return controllerClassType
      ? ([...this.resolvers].find(
          resolver => resolver.controller === controllerClassType,
        ) as Resolver<T>)
      : undefined;
  }

  createOutputFields(
    type: TypeClass | TypeObjectLiteral,
  ): GraphQLFieldConfigMap<unknown, unknown> {
    const reflectionClass = ReflectionClass.from(type);

    const resolver = this.getResolver(type);

    const reflectionClassProperties =
      getNonExcludedReflectionClassProperties(reflectionClass);

    return Object.fromEntries(
      reflectionClassProperties.map(property => {
        let type = this.createOutputType(property.type);

        if (!property.isOptional() && !property.isNullable()) {
          type = new GraphQLNonNull(type);
        }

        let config: GraphQLFieldConfig<unknown, unknown> = {
          description: property.property.description,
          // TODO
          // deprecationReason: '',
          type,
        };

        if (resolver && this.hasFieldResolver(resolver, property.name)) {
          // eslint-disable-next-line functional/immutable-data
          config = Object.assign(
            config,
            this.generateFieldResolver(resolver, property.name),
          );
        }

        return [property.name, config];
      }),
    ) as GraphQLFieldConfigMap<unknown, unknown>;
  }

  createReturnType(type: Type): GraphQLOutputType {
    type = maybeUnwrapPromiseLikeType(type);
    type = maybeUnwrapSubscriptionReturnType(type);

    const isNullable =
      type.kind === ReflectionKind.void ||
      (type.kind === ReflectionKind.union &&
        type.types.some(
          type =>
            type.kind === ReflectionKind.null ||
            type.kind === ReflectionKind.undefined,
        ));

    const outputType = this.createOutputType(type);

    return isNullable ? outputType : new GraphQLNonNull(outputType);
  }

  createInputArgsFromReflectionParameters(
    parameters: readonly ReflectionParameter[],
  ) {
    const argsParameters =
      filterReflectionParametersMetaAnnotationsForArguments(parameters);

    return argsParameters.reduce((args, parameter) => {
      let type = this.createInputType(parameter.type);
      // TODO: assert for null
      if (!parameter.isOptional()) {
        type = new GraphQLNonNull(type);
      }

      const defaultValue = parameter.getDefaultValue();

      const argument = { type, defaultValue };

      return { ...args, [parameter.name]: argument };
    }, {});
  }

  createInputFields(
    type: TypeClass | TypeObjectLiteral,
  ): GraphQLFields<GraphQLInputType> {
    const reflectionClass = ReflectionClass.from(type);

    return Object.fromEntries(
      reflectionClass.getProperties().map(property => {
        let type = this.createOutputType(property.type);
        if (!property.isOptional() && !property.isNullable()) {
          type = new GraphQLNonNull(type);
        }

        return [
          property.name,
          {
            // TODO
            // description: '',
            // TODO
            // deprecationReason: '',
            type,
          },
        ];
      }),
    ) as GraphQLFields<GraphQLInputType>;
  }

  createOutputObjectType(
    type: TypeObjectLiteral | TypeClass,
    extraFields?: GraphQLFields<GraphQLOutputType>,
  ): GraphQLObjectType {
    const name = requireTypeName(type);

    if (this.outputObjectTypes.has(name)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.outputObjectTypes.get(name)!;
    }

    const objectType = new GraphQLObjectType({
      name,
      description: type.description,
      // TODO
      // deprecationReason: '',
      fields: () => {
        const fields = this.createOutputFields(type);
        return { ...fields, ...extraFields };
      },
    });
    this.outputObjectTypes.set(name, objectType);

    return objectType;
  }

  createInputObjectType(type: TypeObjectLiteral | TypeClass): GraphQLInputType {
    const name = requireTypeName(type);

    if (this.inputObjectTypes.has(name)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.inputObjectTypes.get(name)!;
    }

    const inputObjectType = new GraphQLInputObjectType({
      name,
      description: type.description,
      // TODO
      // deprecationReason: '',
      fields: () => this.createInputFields(type),
    });
    this.inputObjectTypes.set(name, inputObjectType);

    return inputObjectType;
  }

  private async executeMiddleware(
    middlewares: readonly InternalMiddleware[],
    injectorContext: InjectorContext,
  ): Promise<void> {
    for (const middleware of middlewares) {
      await asyncOperation<void>(async (resolve, reject) => {
        const next = (err?: Error) => (err ? reject(err) : resolve());

        if (isClass(middleware)) {
          await injectorContext.get(middleware).execute(next);
        } else {
          await middleware(next);
        }
      });
    }
  }

  // TODO: move return type resolution and validation into decorators
  private getSerializableResolveFunctionReturnType<T>(
    resolver: Resolver<T>,
    reflectionMethod: ReflectionMethod,
    type: 'query' | 'mutation' | 'subscription' | 'resolveField',
  ): Type {
    const returnType = maybeUnwrapPromiseLikeType(reflectionMethod.type.return);
    if (type !== 'subscription') return returnType;

    if (
      returnType.typeName === 'AsyncGenerator' ||
      returnType.typeName === 'AsyncIterable' ||
      (returnType as TypeClass).classType === BrokerBusChannel ||
      (returnType as TypeClass).classType === Observable
    ) {
      return maybeUnwrapSubscriptionReturnType(returnType);
    }

    throw new InvalidSubscriptionTypeError(
      returnType,
      reflectionMethod.name,
      resolver.controller.name,
    );
  }

  private createResolveFunction<T, Args extends unknown[] = []>(
    resolver: Resolver<T>,
    reflectionMethod: ReflectionMethod,
    middlewares: readonly InternalMiddleware[],
    type: 'query' | 'mutation' | 'subscription' | 'resolveField',
  ): GraphQLFieldResolver<unknown, GraphQLContext, any> {
    const resolve = (injectorContext: InjectorContext) => {
      const instance = injectorContext.get(
        resolver.controller,
        resolver.module,
      );
      return (
        instance[reflectionMethod.name as keyof typeof instance] as Function
      ).bind(instance);
    };

    const argsParameters =
      filterReflectionParametersMetaAnnotationsForArguments(
        reflectionMethod.parameters,
      );

    const argsType: TypeObjectLiteral = {
      kind: ReflectionKind.objectLiteral,
      types: [],
    };

    argsType.types = argsParameters.map<TypePropertySignature>(parameter => ({
      kind: ReflectionKind.propertySignature,
      parent: argsType,
      name: parameter.name,
      type: parameter.type,
    }));

    const parentParameterIndex =
      getParentMetaAnnotationReflectionParameterIndex(
        reflectionMethod.parameters,
      );

    // const contextParameterIndex =
    //   getContextMetaAnnotationReflectionParameterIndex(
    //     reflectionMethod.parameters,
    //   );

    const deserializeArgs = deserializeFunction(
      serializer,
      undefined,
      argsType,
    );

    const validateArgs = validateFunction(serializer, argsType);

    const returnType = this.getSerializableResolveFunctionReturnType(
      resolver,
      reflectionMethod,
      type,
    );

    const serializeResult = serializeFunction(
      serializer,
      undefined,
      returnType,
    );

    return async (parent, _args, { injectorContext }: GraphQLContext) => {
      const args = deserializeArgs(_args, { loosely: false }) as Record<string, unknown>;
      const argsValidationErrors = validateArgs(args);
      if (argsValidationErrors.length) {
        const originalError = new ValidationError(argsValidationErrors);
        throw new GraphQLError(originalError.message, {
          originalError,
          path: [reflectionMethod.name],
        });
      }

      await this.executeMiddleware(middlewares, injectorContext);

      const resolveArgs = argsParameters.map(
        parameter => args[parameter.name],
      ) as Parameters<ReturnType<typeof resolve>>;

      if (parentParameterIndex !== -1) {
        // eslint-disable-next-line functional/immutable-data
        resolveArgs.splice(parentParameterIndex, 0, parent);
      }

      /*if (contextParameterIndex !== -1) {
        // eslint-disable-next-line functional/immutable-data
        resolveArgs.splice(contextParameterIndex, 0, context);
      }*/

      const result = await resolve(injectorContext)(...resolveArgs);

      if (type === 'subscription') {
        if (result instanceof BrokerBusChannel) {
          const observable = new Observable(subscriber => {
            result.subscribe((value: unknown) =>
              subscriber.next(serializeResult(value)),
            );
          });
          return observableToAsyncIterable(observable);
        }

        if (result instanceof Observable) {
          return observableToAsyncIterable(
            result.pipe(map(value => serializeResult(value))),
          );
        }

        if (!isAsyncIterable(result)) {
          throw new InvalidSubscriptionTypeError(
            reflect(result),
            reflectionMethod.name,
            resolver.controller.name,
          );
        }

        return transformAsyncIteratorResult(result, value =>
          serializeResult(value),
        );
      }

      return serializeResult(result);
    };
  }

  generateSubscriptionResolverFields<T>(
    resolver: Resolver<T>,
  ): GraphQLFieldConfigMap<unknown, GraphQLContext> {
    const metadata = getClassDecoratorMetadata(resolver.controller);
    const resolverType = reflect(resolver.controller);
    const reflectionClass = ReflectionClass.from(resolverType);

    const fields = new Map<
      string,
      GraphQLFieldConfig<unknown, GraphQLContext>
    >();

    // eslint-disable-next-line functional/no-loop-statement
    for (const [methodName, subscription] of metadata.subscriptions.entries()) {
      const reflectionMethod = reflectionClass.getMethod(methodName);

      const args = this.createInputArgsFromReflectionParameters(
        reflectionMethod.parameters,
      );

      const returnType = this.createReturnType(reflectionMethod.type.return);

      const resolve = this.createResolveFunction<T>(
        resolver,
        reflectionMethod,
        [...metadata.middleware, ...subscription.middleware],
        'subscription',
      );

      fields.set(subscription.name, {
        type: returnType,
        description: subscription.description,
        deprecationReason: subscription.deprecationReason,
        args,
        resolve,
      });
    }

    return Object.fromEntries(fields.entries());
  }

  generateMutationResolverFields<T>(
    resolver: Resolver<T>,
  ): GraphQLFieldConfigMap<unknown, GraphQLContext> {
    const metadata = getClassDecoratorMetadata(resolver.controller);
    const resolverType = reflect(resolver.controller);
    const reflectionClass = ReflectionClass.from(resolverType);

    const fields = new Map<
      string,
      GraphQLFieldConfig<unknown, GraphQLContext>
    >();

    // eslint-disable-next-line functional/no-loop-statement
    for (const [methodName, mutation] of metadata.mutations.entries()) {
      const reflectionMethod = reflectionClass.getMethod(methodName);

      const args = this.createInputArgsFromReflectionParameters(
        reflectionMethod.parameters,
      );

      const returnType = this.createReturnType(reflectionMethod.type.return);

      const resolve = this.createResolveFunction<T>(
        resolver,
        reflectionMethod,
        [...metadata.middleware, ...mutation.middleware],
        'mutation',
      );

      fields.set(mutation.name, {
        type: returnType,
        description: mutation.description,
        deprecationReason: mutation.deprecationReason,
        args,
        resolve,
      });
    }

    return Object.fromEntries(fields.entries());
  }

  generateFieldResolver<T>(
    resolver: Resolver<T>,
    fieldName: string,
  ): Pick<GraphQLFieldConfig<unknown, GraphQLContext>, 'args' | 'resolve'> {
    const metadata = getClassDecoratorMetadata(resolver.controller);
    const resolverType = reflect(resolver.controller);
    const reflectionClass = ReflectionClass.from(resolverType);

    const field = [...metadata.resolveFields.values()].find(
      field => field.name === fieldName,
    );
    if (!field) {
      throw new Error(`Field ${fieldName} is missing`);
    }

    const reflectionMethod = reflectionClass.getMethod(field.property);

    const resolve = this.createResolveFunction<T>(
      resolver,
      reflectionMethod,
      [...metadata.middleware, ...field.middleware],
      'resolveField',
    );

    const args = this.createInputArgsFromReflectionParameters(
      reflectionMethod.parameters,
    );

    return {
      // validate that type is the same
      // type: returnType,
      args,
      resolve,
    };
  }

  generateQueryResolverFields<T>(
    resolver: Resolver<T>,
  ): GraphQLFieldConfigMap<unknown, GraphQLContext> {
    const metadata = getClassDecoratorMetadata(resolver.controller);
    const resolverType = reflect(resolver.controller);
    const reflectionClass = ReflectionClass.from(resolverType);

    const fields = new Map<
      string,
      GraphQLFieldConfig<unknown, GraphQLContext>
    >();

    // eslint-disable-next-line functional/no-loop-statement
    for (const [methodName, query] of metadata.queries.entries()) {
      const reflectionMethod = reflectionClass.getMethod(methodName);

      const args = this.createInputArgsFromReflectionParameters(
        reflectionMethod.parameters,
      );

      const returnType = this.createReturnType(reflectionMethod.type.return);

      const resolve = this.createResolveFunction<T>(
        resolver,
        reflectionMethod,
        [...metadata.middleware, ...query.middleware],
        'query',
      );

      fields.set(query.name, {
        type: returnType,
        description: query.description,
        deprecationReason: query.deprecationReason,
        args,
        resolve,
      });
    }

    return Object.fromEntries(fields.entries());
  }

  hasFieldResolver<T>(resolver: Resolver<T>, fieldName: string): boolean {
    const metadata = getClassDecoratorMetadata(resolver.controller);
    return [...metadata.resolveFields.values()].some(
      field => field.name === fieldName,
    );
  }
}
