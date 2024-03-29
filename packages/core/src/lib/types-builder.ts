import { asyncOperation, isClass } from '@deepkit/core';
import { InjectorContext } from '@deepkit/injector';
import { BrokerBusChannel } from '@deepkit/broker';
import { map, Observable } from 'rxjs';
import { observableToAsyncIterable } from '@graphql-tools/utils';
import { TypeNumberBrand } from '@deepkit/type-spec';
import type { ApolloGraphQLObjectTypeExtensions } from '@apollo/subgraph/dist/schemaExtensions';
import {
  deserializeFunction,
  isNullable,
  ReceiveType,
  reflect,
  ReflectionClass,
  ReflectionKind,
  ReflectionMethod,
  ReflectionParameter,
  ReflectionProperty,
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
  BooleanValueNode,
  ConstArgumentNode,
  ConstDirectiveNode,
  ConstValueNode,
  FieldDefinitionNode,
  FloatValueNode,
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
  IntValueNode,
  Kind,
  ListTypeNode,
  NamedTypeNode,
  NameNode,
  NonNullTypeNode,
  ObjectTypeDefinitionNode,
  StringValueNode,
  TypeNode,
} from 'graphql';

import { GraphQLContext, GraphQLFields, InternalMiddleware } from './types';
import {
  GraphQLPropertyMetadata,
  GraphQLPropertyType,
  typeResolvers,
} from './decorators';
import { Resolver, Resolvers } from './resolvers';
import {
  InvalidSubscriptionTypeError,
  MissingNumberDecoratorError,
  TypeNameRequiredError,
  UnsupportedScalarTypeError,
  UnsupportedScalarTypeForClassError,
} from './errors';
import {
  BigInt,
  BinaryBigInt,
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
  SignedBinaryBigInt,
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
  hasDecorator,
  isAsyncIterable,
  isParameterNullable,
  maybeUnwrapPromiseLikeType,
  maybeUnwrapSubscriptionReturnType,
  requireTypeName,
  transformAsyncIteratorResult,
} from './utils';
import {
  FederationDirective,
  getMetaAnnotationDirectiveName,
  getMetaAnnotationDirectiveOptions,
  getMetaAnnotationDirectives,
  hasMetaAnnotationDirective,
  isMetaAnnotationDirective,
} from './directives';

export class TypesBuilder {
  private readonly outputObjectTypes = new Map<string, GraphQLObjectType>();

  private readonly enumTypes = new WeakMap<TypeEnum, GraphQLEnumType>();

  private readonly unionTypes = new WeakMap<TypeUnion, GraphQLUnionType>();

  private readonly inputObjectTypes = new Map<string, GraphQLInputObjectType>();

  constructor(
    private readonly resolvers: Resolvers, // private readonly orphanedTypes?: (TypeClass | TypeObjectLiteral)[],
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
        switch (true) {
          case hasDecorator(type, 'SignedBinaryBigInt'):
            return SignedBinaryBigInt;

          case hasDecorator(type, 'BinaryBigInt'):
            return BinaryBigInt;

          default:
            return BigInt;
        }

      case ReflectionKind.number: {
        const hasPositiveNoZeroDecorator = hasDecorator(type, 'PositiveNoZero');
        const hasPositiveDecorator = hasDecorator(type, 'Positive');
        const hasNegativeNoZeroDecorator = hasDecorator(type, 'NegativeNoZero');
        const hasNegativeDecorator = hasDecorator(type, 'Negative');

        switch (type.brand) {
          case TypeNumberBrand.float:
          case TypeNumberBrand.float32:
          case TypeNumberBrand.float64:
            switch (true) {
              case hasPositiveNoZeroDecorator:
                return PositiveFloat;

              case hasNegativeNoZeroDecorator:
                return NegativeFloat;

              case hasNegativeDecorator:
                return NonPositiveFloat;

              case hasPositiveDecorator:
                return NonNegativeFloat;

              default:
                return Float;
            }

          case TypeNumberBrand.uint8:
          case TypeNumberBrand.uint16:
          case TypeNumberBrand.uint32:
            return PositiveInt;

          case TypeNumberBrand.integer:
          case TypeNumberBrand.int8:
          case TypeNumberBrand.int16:
          case TypeNumberBrand.int32:
            switch (true) {
              case hasPositiveNoZeroDecorator:
                return PositiveInt;

              case hasNegativeNoZeroDecorator:
                return NegativeInt;

              case hasNegativeDecorator:
                return NonPositiveInt;

              case hasPositiveDecorator:
                return NonNegativeInt;

              default:
                return Int;
            }

          default:
            throw new MissingNumberDecoratorError();
        }
      }

      case ReflectionKind.literal:
        return String;

      case ReflectionKind.string:
        switch (true) {
          case type.typeName === 'UUID':
            return UUID;

          default:
            return String;
        }

      default:
        throw new UnsupportedScalarTypeError(type);
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

      // TODO: Custom scalars
      case ArrayBuffer.name:
      case Int8Array.name:
      case Uint8Array.name:
      case Int16Array.name:
      case Uint16Array.name:
      case Int32Array.name:
      case Uint32Array.name:
      case Float32Array.name:
      case Float64Array.name:
      case BigInt64Array.name:
      case BigUint64Array.name:
        return Byte;

      default:
        throw new UnsupportedScalarTypeForClassError(type);
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
        return this.getSupportedScalarTypeForClass(type, type =>
          this.createNamedInputType(type),
        );
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

      case ReflectionKind.class:
        return this.getSupportedScalarTypeForClass(type, type =>
          this.createInputObjectType(type),
        );

      case ReflectionKind.array:
        return this.createInputListType(type);

      case ReflectionKind.enum:
        return this.createEnumType(type);

      default:
        return this.getScalarType(type);
    }
  }

  getSupportedScalarTypeForClass<T>(
    type: TypeClass,
    fallback: (type: TypeClass) => T,
  ): GraphQLScalarType | T {
    try {
      return this.getScalarTypeForClass(type);
    } catch (err) {
      if (err instanceof UnsupportedScalarTypeForClassError) {
        return fallback(type);
      }
      throw err;
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

        return typesWithoutNullAndUndefined.length === 1
          ? this.createNamedOutputType(typesWithoutNullAndUndefined[0])
          : this.createUnionType(type);
      }

      case ReflectionKind.propertySignature:
        return this.createNamedOutputType(type.type);

      case ReflectionKind.objectLiteral:
        return this.createOutputObjectType(type);

      case ReflectionKind.class:
        return this.getSupportedScalarTypeForClass(type, type =>
          this.createOutputObjectType(type),
        );

      case ReflectionKind.enum:
        return this.createEnumType(type);

      default:
        return this.getScalarType(type);
    }
  }

  createNameNode(value: string): NameNode {
    return {
      kind: Kind.NAME,
      value,
    };
  }

  createObjectTypeDefinitionNode(
    type: TypeObjectLiteral | TypeClass,
  ): ObjectTypeDefinitionNode {
    const reflectionClass = ReflectionClass.from(type);

    const name = type.typeName || reflectionClass.getName();

    const objectTypeDirectives = getMetaAnnotationDirectives(
      type,
    ).map(annotation => this.createAnnotationDirectiveNode(annotation));

    const federationKeyDirectives = reflectionClass
      .getProperties()
      .reduce((directives, property) => {
        const annotations = getMetaAnnotationDirectives(property.type);

        if (hasMetaAnnotationDirective(annotations, FederationDirective.KEY)) {
          return [
            ...directives,
            this.createFederationKeyDirectiveNode(property.name),
          ];
        }

        return directives;
      }, [] as readonly ConstDirectiveNode[]);

    const directives: readonly ConstDirectiveNode[] = [
      ...objectTypeDirectives,
      ...federationKeyDirectives,
    ];

    const fields = reflectionClass
      .getProperties()
      .map(property => this.createFieldDefinitionNode(property));

    return {
      kind: Kind.OBJECT_TYPE_DEFINITION,
      name: {
        kind: Kind.NAME,
        value: name,
      },
      directives,
      fields,
    };
  }

  createConstDirectiveNode(
    name: string,
    args?: readonly ConstArgumentNode[],
  ): ConstDirectiveNode {
    return {
      kind: Kind.DIRECTIVE,
      name: {
        kind: Kind.NAME,
        value: name,
      },
      arguments: args,
    };
  }

  createConstArgumentNode(
    name: string,
    value: ConstValueNode,
  ): ConstArgumentNode {
    return {
      kind: Kind.ARGUMENT,
      name: {
        kind: Kind.NAME,
        value: name,
      },
      value,
    };
  }

  // TODO: multiple fields ?
  createFederationKeyDirectiveNode(name: string): ConstDirectiveNode {
    return this.createConstDirectiveNode(FederationDirective.KEY, [
      this.createConstArgumentNode('fields', this.createStringValueNode(name)),
    ]);
  }

  createConstValueNode(type: Type): ConstValueNode {
    switch (type.kind) {
      case ReflectionKind.literal:
        switch (typeof type.literal) {
          case 'string':
            return this.createStringValueNode(type.literal);

          // TODO: handle Int & Float
          case 'number':
            return this.createIntValueNode(type.literal);

          case 'symbol':
            return this.createStringValueNode(type.literal.toString());

          case 'boolean':
            return this.createStringValueNode(type.literal.toString());

          default:
            throw new Error(
              `Type literal ${typeof type.literal} not supported`,
            );
        }

      default:
        throw new Error(`Type ${type.kind} not supported`);
    }
  }

  createAnnotationDirectiveNode(annotation: Type): ConstDirectiveNode {
    const args = getMetaAnnotationDirectiveOptions(annotation).map(option =>
      this.createConstArgumentNode(
        option.name.toString(),
        this.createConstValueNode(option.type),
      ),
    );

    return this.createConstDirectiveNode(
      getMetaAnnotationDirectiveName(annotation),
      args,
    );
  }

  createStringValueNode(value: string): StringValueNode {
    return {
      kind: Kind.STRING,
      block: false,
      value,
    };
  }

  createIntValueNode(value: number): IntValueNode {
    return {
      kind: Kind.INT,
      value: value.toString(),
    };
  }

  createFloatValueNode(value: number): FloatValueNode {
    return {
      kind: Kind.FLOAT,
      value: value.toString(),
    };
  }

  createBooleanValueNode(value: boolean): BooleanValueNode {
    return {
      kind: Kind.BOOLEAN,
      value,
    };
  }

  createFieldDefinitionNode(property: ReflectionProperty): FieldDefinitionNode {
    const description = property.getDescription()
      ? this.createStringValueNode(property.getDescription())
      : undefined;

    const directives = getMetaAnnotationDirectives(property.type)
      .filter(
        annotation =>
          !isMetaAnnotationDirective(annotation, FederationDirective.KEY),
      )
      .map(annotation => this.createAnnotationDirectiveNode(annotation));

    return {
      kind: Kind.FIELD_DEFINITION,
      description,
      directives,
      name: this.createNameNode(property.getNameAsString()),
      type: this.createTypeNode(property.type),
    };
  }

  createNonNullTypeNode(type: NamedTypeNode | ListTypeNode): NonNullTypeNode {
    return {
      kind: Kind.NON_NULL_TYPE,
      type,
    };
  }

  getTypeNodeName(type: Type): string {
    try {
      return this.getScalarType(type).name;
    } catch (err) {
      if (
        err instanceof UnsupportedScalarTypeError ||
        err instanceof UnsupportedScalarTypeForClassError
      ) {
        return getTypeName(type);
      }
      throw err;
    }
  }

  createTypeNode(type: Type): TypeNode {
    if (type.kind === ReflectionKind.union && isNullable(type)) {
      const types = excludeNullAndUndefinedTypes(type.types);
      return this.createTypeNode(types[0]);
    }

    if (type.kind === ReflectionKind.array) {
      return this.createNonNullTypeNode({
        kind: Kind.LIST_TYPE,
        type: this.createTypeNode(type.type),
      });
    }

    return this.createNonNullTypeNode({
      kind: Kind.NAMED_TYPE,
      name: this.createNameNode(this.getTypeNodeName(type)),
    });
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
        return this.getSupportedScalarTypeForClass(type, type =>
          this.createOutputObjectType(type),
        );
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

  createReturnType(type: Type): GraphQLOutputType {
    type = maybeUnwrapPromiseLikeType(type);
    type = maybeUnwrapSubscriptionReturnType(type);

    const nullable = type.kind === ReflectionKind.void || isNullable(type);

    const outputType = this.createOutputType(type);

    return nullable ? outputType : new GraphQLNonNull(outputType);
  }

  createInputArgsFromReflectionParameters(
    parameters: readonly ReflectionParameter[],
  ) {
    const argsParameters =
      filterReflectionParametersMetaAnnotationsForArguments(parameters);

    return argsParameters.reduce((args, parameter) => {
      let type = this.createInputType(parameter.type);
      if (!isParameterNullable(parameter)) {
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
  ): GraphQLObjectType {
    const name = requireTypeName(type);

    console.log(name);

    if (this.outputObjectTypes.has(name)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.outputObjectTypes.get(name)!;
    }

    const typeReflectionClass = ReflectionClass.from(type);

    const typeReflectionClassProperties =
      getNonExcludedReflectionClassProperties(typeReflectionClass);

    const resolver = this.getResolver(typeReflectionClass.type);

    const extensions: ApolloGraphQLObjectTypeExtensions<
      unknown,
      GraphQLContext
    > = {};

    // TODO: add tests
    if (resolver) {
      const resolverMetadata = getClassDecoratorMetadata(resolver.controller);

      const referenceResolverMetadata =
        this.getReferenceResolverPropertyMetadata(
          resolver,
          typeReflectionClassProperties,
        );

      if (referenceResolverMetadata) {
        const controllerReflectionClass = ReflectionClass.from(
          referenceResolverMetadata.classType,
        );

        const reflectionMethod = controllerReflectionClass.getMethod(
          referenceResolverMetadata.property,
        );

        const resolveReference = this.createResolveFunction(
          resolver,
          reflectionMethod,
          [
            ...resolverMetadata.middleware,
            ...referenceResolverMetadata.middleware,
          ],
          referenceResolverMetadata.type,
        );

        extensions.apollo = {
          ...extensions.apollo,
          subgraph: {
            ...extensions.apollo?.subgraph,
            resolveReference: (source, context, info) =>
              resolveReference(source, undefined, context, info),
          },
        };
      }
    }

    const objectType = new GraphQLObjectType({
      name,
      description: type.description,
      // TODO
      // deprecationReason: '',
      extensions,
      astNode: this.createObjectTypeDefinitionNode(type),
      fields: () =>
        Object.fromEntries(
          typeReflectionClassProperties.map(property => {
            let type = this.createOutputType(property.type);

            if (!property.isOptional() && !property.isNullable()) {
              type = new GraphQLNonNull(type);
            }

            let config: GraphQLFieldConfig<unknown, unknown> = {
              description: property.property.description,
              astNode: this.createFieldDefinitionNode(property),
              // TODO
              // deprecationReason: '',
              type,
            };

            if (resolver) {
              if (this.hasFieldResolver(resolver, property.name)) {
                // eslint-disable-next-line functional/immutable-data
                config = Object.assign(
                  config,
                  this.generateFieldResolver(resolver, property.name),
                );
              }

              /*if (this.hasReferenceResolver(resolver, property.name)) {
                // TODO: Do this check when applying decorators
                if (
                  !propertyDirectives ||
                  !hasMetaAnnotationDirective(
                    propertyDirectives,
                    FEDERATION_KEY_DIRECTIVE_NAME,
                  )
                ) {
                  throw new MissingFederatedKeyAnnotationError(
                    property,
                    reflectionClass,
                  );
                }
                // eslint-disable-next-line functional/immutable-data
                config = Object.assign(
                  config,
                  this.generateFieldResolver(resolver, property.name),
                );
              }*/
            }

            return [property.name, config];
          }),
        ),
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
    type: GraphQLPropertyType,
  ): Type {
    const returnType = maybeUnwrapPromiseLikeType(reflectionMethod.type.return);
    if (type !== GraphQLPropertyType.SUBSCRIPTION) return returnType;

    if (
      returnType.typeName !== 'AsyncGenerator' &&
      returnType.typeName !== 'AsyncIterable' &&
      (returnType as TypeClass).classType !== BrokerBusChannel &&
      (returnType as TypeClass).classType !== Observable
    ) {
      throw new InvalidSubscriptionTypeError(
        returnType,
        reflectionMethod.name,
        resolver.controller.name,
      );
    }

    return maybeUnwrapSubscriptionReturnType(returnType);
  }

  private createResolveFunction<T, Args extends unknown[] = []>(
    resolver: Resolver<T>,
    reflectionMethod: ReflectionMethod,
    middlewares: readonly InternalMiddleware[],
    type: GraphQLPropertyType,
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
      const args = deserializeArgs(_args, { loosely: false }) as Record<
        string,
        unknown
      >;
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

      if (type === GraphQLPropertyType.SUBSCRIPTION) {
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
        GraphQLPropertyType.SUBSCRIPTION,
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
        GraphQLPropertyType.MUTATION,
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

  generateReferenceResolver<T>(resolver: Resolver<T>) {}

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
      GraphQLPropertyType.RESOLVE_FIELD,
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
        GraphQLPropertyType.QUERY,
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

  getReferenceResolverPropertyMetadata<T>(
    resolver: Resolver<T>,
    properties: readonly ReflectionProperty[],
  ): GraphQLPropertyMetadata | undefined {
    const metadata = getClassDecoratorMetadata(resolver.controller);
    const reflectionPropertyNames = properties.map(property => property.name);
    return [...metadata.resolveReferences.values()].find(reference =>
      reflectionPropertyNames.includes(reference.name),
    );
  }
}
