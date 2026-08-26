import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TechArticlePipelineClient } from './tech-article-pipeline.client';

/**
 * 아티클 상세 조회수를 집계합니다. 운영 판단용이며 사용자별 이력은 남기지 않습니다.
 *
 * 응답이 끝난 뒤(res 'finish')에 세는 이유 — 요청을 받은 시점에는 그 요청이
 * 실제로 열람으로 이어질지 알 수 없습니다. 인증 가드는 서명과 만료뿐 아니라
 * refresh 토큰 여부, 사용자 존재, 로그아웃 상태까지 봅니다. 미들웨어가 토큰을
 * 직접 검증하면 가드가 401 로 막는 요청까지 회원 열람으로 세게 됩니다.
 * 상태 코드는 가드와 컨트롤러가 내린 최종 판정이므로 그대로 씁니다.
 *
 *   200·304 → 회원 열람. 304 는 브라우저 캐시 재검증입니다. 응답 본문만
 *              생략됐을 뿐 가드를 통과하고 아티클을 찾은 열람이라, 세지 않으면
 *              같은 글을 다시 본 회원이 통째로 빠집니다. 상세 응답에는
 *              Cache-Control 이 없어 브라우저가 ETag 로 매번 되물어 옵니다.
 *   401 + Authorization 헤더 없음 → 비회원 열람 시도
 *   401 + Authorization 헤더 있음 → 세지 않음. 토큰을 들고 왔다는 것은
 *              비회원이 아니라 만료된 회원입니다. 프런트(api/client.js)가
 *              401 을 받으면 refresh 로 새 토큰을 받아 같은 요청을 다시
 *              보내므로, 여기서 세면 한 번의 방문이 비회원 +1, 회원 +1 로
 *              두 번 잡힙니다. access token 만료가 15분이라 흔한 경로입니다.
 *   그 외 → 세지 않음. 404 는 비공개·보관·없는 아티클이라 열람이 아니고,
 *           5xx 는 우리 쪽 실패라 사용자 행동이 아닙니다.
 *
 * 가드가 아니라 미들웨어인 이유 — Nest 는 미들웨어를 가드보다 먼저 실행하므로
 * 가드가 401 로 끊는 요청에도 이 훅을 걸어 둘 수 있습니다.
 *
 * 기록은 fire-and-forget 입니다. 응답은 이미 나갔고, 조회수는 부가 기능이라
 * 실패하더라도 아티클 조회를 늦추거나 막아서는 안 됩니다.
 */
const RESERVED_SEGMENTS = new Set(['tags', 'sources']);

@Injectable()
export class TechArticleViewMiddleware implements NestMiddleware {
  constructor(private readonly pipeline: TechArticlePipelineClient) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const articleId = request.params?.articleId;
    // /tags 와 /sources 도 같은 자리의 한 조각이라 :articleId 로 잡힙니다.
    // 모듈에서 exclude 하고 있지만, 경로가 늘어날 때 놓치지 않도록 여기서도
    // 한 번 더 거릅니다. 이걸 빼면 태그 목록을 부를 때마다 조회수가 오릅니다.
    if (articleId && !RESERVED_SEGMENTS.has(articleId)) {
      const authenticated = Boolean(request.headers?.authorization);
      response.on('finish', () => {
        const member = this.classify(response.statusCode, authenticated);
        if (member !== null) void this.record(articleId, member);
      });
    }
    next();
  }

  /** 회원이면 true, 비회원 시도면 false, 세지 않을 응답이면 null. */
  private classify(status: number, authenticated: boolean): boolean | null {
    if (status === 200 || status === 304) return true;
    if (status === 401) return authenticated ? null : false;
    return null;
  }

  private async record(articleId: string, member: boolean): Promise<void> {
    try {
      await this.pipeline.post(
        `/internal/v1/public/articles/${encodeURIComponent(articleId)}/view` +
          `?member=${member ? 'true' : 'false'}`,
        {},
      );
    } catch {
      // 집계 실패는 조용히 넘깁니다. 파이프라인 쪽에도 로그가 남습니다.
    }
  }
}
