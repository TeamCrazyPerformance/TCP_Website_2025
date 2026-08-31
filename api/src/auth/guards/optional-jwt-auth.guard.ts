import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';

/** 익명 요청은 통과시키되, 전달된 토큰의 인증 실패는 기존처럼 401로 처리합니다. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = await super.canActivate(context);
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: unknown }>();
    const response = http.getResponse<Response>();
    response.locals.techArticleViewer = request.user ? 'MEMBER' : 'GUEST';
    return allowed as boolean;
  }

  // @nestjs/passport의 제네릭 handleRequest 계약과 호환되도록 any를 사용합니다.
  // eslint 설정에서도 이 프레임워크 경계의 explicit any는 허용됩니다.
  handleRequest(
    err: unknown,
    user: unknown,
    _info: unknown,
    context: ExecutionContext,
  ): any {
    const request = context.switchToHttp().getRequest<Request>();
    const hasAuthorizationHeader = request.headers.authorization !== undefined;
    if (hasAuthorizationHeader) {
      if (err) {
        if (err instanceof Error) throw err;
        throw new UnauthorizedException();
      }
      if (!user) throw new UnauthorizedException();
      return user;
    }
    return undefined;
  }
}
