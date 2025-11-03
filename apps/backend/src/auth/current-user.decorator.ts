import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

type HttpRequestWithUser = {
  user?: unknown;
};

type GraphQLContext = {
  req: {
    user?: unknown;
  };
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const contextType = context.getType();

    if (contextType === 'http') {
      const request = context.switchToHttp().getRequest<HttpRequestWithUser>();
      return request.user;
    }

    const gqlContext = GqlExecutionContext.create(context);
    const requestContext = gqlContext.getContext<GraphQLContext>();
    return requestContext.req.user;
  },
);
