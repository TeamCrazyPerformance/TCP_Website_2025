import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  function context(
    request: Record<string, unknown>,
    response = { locals: {} },
  ) {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  }

  afterEach(() => jest.restoreAllMocks());

  it('allows a request without an Authorization header as a guest', () => {
    const guard = new OptionalJwtAuthGuard();
    expect(
      guard.handleRequest(
        null,
        false,
        new Error('No auth token'),
        context({
          headers: {},
        }),
      ),
    ).toBeUndefined();
  });

  it('does not downgrade an invalid supplied token to a guest', () => {
    const guard = new OptionalJwtAuthGuard();
    expect(() => {
      guard.handleRequest(
        null,
        false,
        {},
        context({
          headers: { authorization: 'Bearer invalid' },
        }),
      );
    }).toThrow(UnauthorizedException);
  });

  it.each([
    [undefined, 'GUEST'],
    [{ userId: 'member-1' }, 'MEMBER'],
  ])('marks a successful request as %s', async (user, expected) => {
    const base = AuthGuard('jwt');
    jest
      .spyOn(base.prototype, 'canActivate')
      .mockImplementation((ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest<{ user?: unknown }>();
        request.user = user;
        return Promise.resolve(true);
      });
    const response = { locals: {} };
    const guard = new OptionalJwtAuthGuard();

    await expect(
      guard.canActivate(context({ headers: {} }, response)),
    ).resolves.toBe(true);
    expect(response.locals).toEqual({ techArticleViewer: expected });
  });

  it('does not mark a viewer when authentication throws', async () => {
    const base = AuthGuard('jwt');
    jest
      .spyOn(base.prototype, 'canActivate')
      .mockRejectedValue(new UnauthorizedException());
    const response = { locals: {} };
    const guard = new OptionalJwtAuthGuard();

    await expect(
      guard.canActivate(
        context({ headers: { authorization: 'Bearer expired' } }, response),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(response.locals).toEqual({});
  });
});
