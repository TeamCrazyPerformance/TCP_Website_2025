import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TechArticlePipelineClient } from './tech-article-pipeline.client';

/**
 * 아티클 상세 조회수를 집계합니다. 운영 판단용이며 사용자별 이력은 남기지 않습니다.
 *
 * 응답이 끝난 뒤(res 'finish')에 세는 이유 — 요청을 받은 시점에는 그 요청이
 * 실제로 열람으로 이어질지 알 수 없습니다. 미들웨어는 가드보다 먼저 실행되어
 * request.user 를 읽을 수 없지만, finish 콜백은 가드와 컨트롤러가 끝난 뒤라
 * OptionalJwtAuthGuard가 res.locals에 남긴 최종 판정을 읽을 수 있습니다.
 *
 *   200·304 + MEMBER → 회원 열람
 *   200·304 + GUEST  → 비회원 실제 열람. 304는 ETag 재검증이며 가드와
 *                      컨트롤러가 이미 실행된 뒤라 locals도 채워져 있습니다.
 *   locals 없음      → 세지 않음. 토큰을 들고 온 401은 가드가 던지므로
 *                      locals가 비어 있고 refresh 재시도와 중복 집계되지 않습니다.
 *   그 외            → 세지 않음. 404·5xx는 실제 열람이 아닙니다.
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
      response.on('finish', () => {
        const member = this.classify(response);
        if (member !== null) void this.record(articleId, member);
      });
    }
    next();
  }

  /** 회원이면 true, 비회원 실제 열람이면 false, 세지 않을 응답이면 null. */
  private classify(response: Response): boolean | null {
    if (response.statusCode !== 200 && response.statusCode !== 304) return null;
    const viewer = (response.locals as { techArticleViewer?: unknown })
      .techArticleViewer;
    if (viewer === 'MEMBER') return true;
    if (viewer === 'GUEST') return false;
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
