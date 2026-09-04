import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TechArticlePipelineClient } from './tech-article-pipeline.client';

/** Records explicitly requested views after the auth guard has classified the viewer. */
const RESERVED_SEGMENTS = new Set(['tags', 'sources']);

@Injectable()
export class TechArticleViewMiddleware implements NestMiddleware {
  constructor(private readonly pipeline: TechArticlePipelineClient) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const articleId = request.params?.articleId;
    const shouldRecordView = request.query?.recordView === 'true';
    if (shouldRecordView && articleId && !RESERVED_SEGMENTS.has(articleId)) {
      response.on('finish', () => {
        const member = this.classify(response);
        if (member !== null) void this.record(articleId, member);
      });
    }
    next();
  }

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
      // View metrics must not block article delivery.
    }
  }
}
