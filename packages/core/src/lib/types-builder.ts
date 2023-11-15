import { asyncOperation, isClass } from '@deepkit/core';
import { InjectorContext } from '@deepkit/injector';
import {
  ReceiveType,
  ReflectionClass,
  ReflectionKind,
  ReflectionParameter,
  resolveReceiveType,
  reflect,
  Type,
  TypeArray,
  TypeClass,
  TypeEnum,
  TypeNumberBrand,
  TypeObjectLiteral,
  TypeUnion,
  ReflectionMethod,
  TypePropertySignature,
  deserializeFunction,
  serializer,
  validateFunction,
  serializeFunction,
  ValidationError,
} from '@deepkit/type';
import {
  GraphQLEnumType,
  GraphQLEnumValueConfigMap,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLList,
  GraphQLNamedInputType,
  GraphQLNamedOutputType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLError,
  GraphQLFieldResolver,
  GraphQLUnionType,
} from 'graphql';

import { Context, GraphQLFields, Instance, InternalMiddleware } from './types';
import { typeResolvers } from './decorators';
import { Resolvers } from './resolvers';
import { TypeNameRequiredError } from './errors';
import {
  BigInt,
  Void,
  Boolean,
  ID as GraphQLID,
  Float,
  PositiveFloat,
  NegativeFloat,
  NonPositiveFloat,
  NonNegativeFloat,
  PositiveInt,
  Int,
  NegativeInt,
  NonNegativeInt,
  NonPositiveInt,
  String,
  UUID,
  DateTime,
  Byte,
} from './scalars';
import {
  filterReflectionParametersMetaAnnotationsForArguments,
  getContextMetaAnnotationReflectionParameterIndex,
  getParentMetaAnnotationReflectionParameterIndex,
  getTypeName,
  excludeNullAndUndefinedTypes,
  requireTypeName,
  unwrapPromiseLikeType,
  getClassDecoratorMetadata,
} from './utils';

export class TypesBuilder {
  private readonly outputObjectTypes = new Map<string, GraphQLObjectType>();

  private readonly enumTypes = new WeakMap<TypeEnum, GraphQLEnumType>();

  private readonly unionTypes = new WeakMap<TypeUnion, GraphQLUnionType>();

  private readonly inputObjectTypes = new Map<string, GraphQLInputObjectType>();

  constructor(
    private readonly resolvers: Resolvers,
    private readonly injectorContext: InjectorContext,
  ) {}

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
        console.log(type);
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
        const typesWithoutNullAndUndefined = type.types.filter(
          type =>
            type.kind !== ReflectionKind.undefined &&
            type.kind !== ReflectionKind.null,
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

  getResolver(type: TypeClass | TypeObjectLiteral): Instance | undefined {
    const typeName = requireTypeName(type);
    const resolverClassType = typeResolvers.get(typeName);
    return resolverClassType && this.resolvers?.get(resolverClassType);
  }

  createOutputFields(
    type: TypeClass | TypeObjectLiteral,
  ): GraphQLFieldConfigMap<unknown, unknown> {
    const reflectionClass = ReflectionClass.from(type);

    const resolver = this.getResolver(type);

    return Object.fromEntries(
      reflectionClass.getProperties().map(property => {
        let type = this.createOutputType(property.type);
        if (!property.isOptional() && !property.isNullable()) {
          type = new GraphQLNonNull(type);
        }

        let config: GraphQLFieldConfig<unknown, unknown> = {
          // TODO
          // description: '',
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
    type = unwrapPromiseLikeType(type);

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
      return this.outputObjectTypes.get(name)!;
    }

    const objectType = new GraphQLObjectType({
      name,
      // TODO
      // description: '',
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
      return this.inputObjectTypes.get(name)!;
    }

    const inputObjectType = new GraphQLInputObjectType({
      name,
      // TODO
      // description: '',
      // TODO
      // deprecationReason: '',
      fields: () => this.createInputFields(type),
    });
    this.inputObjectTypes.set(name, inputObjectType);

    return inputObjectType;
  }

  private async executeMiddleware(
    middlewares: readonly InternalMiddleware[],
    context: Context<unknown>,
  ): Promise<void> {
    for (const middleware of middlewares) {
      await asyncOperation<void>(async (resolve, reject) => {
        const next = (err?: Error) => (err ? reject(err) : resolve());

        if (isClass(middleware)) {
          await this.injectorContext.get(middleware).execute(context, next);
        } else {
          await middleware(context, next);
        }
      });
    }
  }

  private createResolveFunction<Resolver, Args extends unknown[] = []>(
    instance: Resolver,
    { parameters, name, type }: ReflectionMethod,
    middlewares: readonly InternalMiddleware[],
  ): GraphQLFieldResolver<unknown, unknown, any> {
    const resolve = (instance[name as keyof Resolver] as Function).bind(
      instance,
    ) as (...args: Args) => unknown;

    const argsParameters =
      filterReflectionParametersMetaAnnotationsForArguments(parameters);

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
      getParentMetaAnnotationReflectionParameterIndex(parameters);

    const contextParameterIndex =
      getContextMetaAnnotationReflectionParameterIndex(parameters);

    const deserializeArgs = deserializeFunction(
      { loosely: false },
      serializer,
      undefined,
      argsType,
    );

    const validateArgs = validateFunction(serializer, argsType);

    const serializeResult = serializeFunction(
      undefined,
      serializer,
      undefined,
      type.return,
    );

    return async (parent, _args, context) => {
      const args = deserializeArgs(_args) as Record<string, unknown>; // might return undefined ?
      const argsValidationErrors = validateArgs(args);
      if (argsValidationErrors.length) {
        const originalError = new ValidationError(argsValidationErrors);
        throw new GraphQLError(originalError.message, {
          originalError,
          path: [name],
        });
      }

      await this.executeMiddleware(middlewares, context as Context<unknown>);

      const resolveArgs = argsParameters.map(
        parameter => args[parameter.name],
      ) as Parameters<typeof resolve>;

      if (parentParameterIndex !== -1) {
        // eslint-disable-next-line functional/immutable-data
        resolveArgs.splice(parentParameterIndex, 0, parent);
      }

      if (contextParameterIndex !== -1) {
        // eslint-disable-next-line functional/immutable-data
        resolveArgs.splice(contextParameterIndex, 0, context);
      }

      const result = await resolve(...resolveArgs);
      return serializeResult(result);
    };
  }

  generateMutationResolverFields<T>(
    instance: Instance<T>,
  ): GraphQLFieldConfigMap<unknown, unknown> {
    const resolver = getClassDecoratorMetadata(instance.constructor);
    const resolverType = reflect(instance.constructor);
    const reflectionClass = ReflectionClass.from(resolverType);

    const fields = new Map<string, GraphQLFieldConfig<unknown, unknown>>();

    // eslint-disable-next-line functional/no-loop-statement
    for (const [methodName, mutation] of resolver.mutations.entries()) {
      const reflectionMethod = reflectionClass.getMethod(methodName);

      const args = this.createInputArgsFromReflectionParameters(
        reflectionMethod.parameters,
      );

      const returnType = this.createReturnType(reflectionMethod.type.return);

      const resolve = this.createResolveFunction<T>(
        instance,
        reflectionMethod,
        [...resolver.middleware, ...mutation.middleware],
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
    instance: Instance<T>,
    fieldName: string,
  ): Pick<GraphQLFieldConfig<unknown, unknown>, 'args' | 'resolve'> {
    const resolver = getClassDecoratorMetadata(instance.constructor);
    const resolverType = reflect(instance.constructor);
    const reflectionClass = ReflectionClass.from(resolverType);

    const field = [...resolver.resolveFields.values()].find(
      field => field.name === fieldName,
    );
    if (!field) {
      throw new Error(`Field ${fieldName} is missing`);
    }

    const reflectionMethod = reflectionClass.getMethod(field.property);

    // const returnType = createReturnType(reflectionMethod.type.return);

    const resolve = this.createResolveFunction<T>(instance, reflectionMethod, [
      ...resolver.middleware,
      ...field.middleware,
    ]);

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
    instance: Instance<T>,
  ): GraphQLFieldConfigMap<unknown, unknown> {
    const resolver = getClassDecoratorMetadata(instance.constructor);
    const resolverType = reflect(instance.constructor);
    const reflectionClass = ReflectionClass.from(resolverType);

    const fields = new Map<string, GraphQLFieldConfig<unknown, unknown>>();

    // eslint-disable-next-line functional/no-loop-statement
    for (const [methodName, query] of resolver.queries.entries()) {
      const reflectionMethod = reflectionClass.getMethod(methodName);

      const args = this.createInputArgsFromReflectionParameters(
        reflectionMethod.parameters,
      );

      const returnType = this.createReturnType(reflectionMethod.type.return);

      const resolve = this.createResolveFunction<T>(
        instance,
        reflectionMethod,
        [...resolver.middleware, ...query.middleware],
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

  hasFieldResolver<T>(instance: Instance<T>, fieldName: string): boolean {
    const resolver = getClassDecoratorMetadata(instance.constructor);
    return [...resolver.resolveFields.values()].some(
      field => field.name === fieldName,
    );
  }
}
