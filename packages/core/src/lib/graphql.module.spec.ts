import { GraphQLContext } from './types';
import { GraphQLModule } from './graphql.module';
import {
  DirectiveLocation,
  GraphQLFieldConfig,
  GraphQLFieldResolver,
  GraphQLSchema,
} from 'graphql';
import { ServiceContainer } from '@deepkit/app';
import {
  Directive,
  DirectiveAnnotation,
  ExtractTypeAnnotationOptions,
} from './directives';

describe('GraphQLModule', () => {
  test('directives', () => {
    type Upper = DirectiveAnnotation<'upper', { include: boolean }>;

    class UpperDirective extends Directive<Upper>({
      locations: [DirectiveLocation.FIELD_DEFINITION],
    }) {
      transformObjectField(
        args: ExtractTypeAnnotationOptions<Upper>,
      ): GraphQLFieldResolver<unknown, GraphQLContext> {
        return () => {
          // TODO: args should be validated automatically
        };
      }
    }

    const module = new GraphQLModule({ directives: [UpperDirective] });

    const injectorContext = new ServiceContainer(module).getInjectorContext();

    expect(injectorContext.get(UpperDirective)).toBeInstanceOf(UpperDirective);
  });
});
