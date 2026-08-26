import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AdminTechArticlesController } from './admin-tech-articles.controller';
import { TechArticleCrawlScheduler } from './tech-article-crawl.scheduler';
import { TechArticlePipelineClient } from './tech-article-pipeline.client';
import { TechArticleViewMiddleware } from './tech-article-view.middleware';
import { TechArticlesController } from './tech-articles.controller';
import { TechArticlesService } from './tech-articles.service';

@Module({
  controllers: [TechArticlesController, AdminTechArticlesController],
  providers: [
    TechArticlePipelineClient,
    TechArticlesService,
    TechArticleCrawlScheduler,
    TechArticleViewMiddleware,
  ],
})
export class TechArticlesModule implements NestModule {
  // 조회수 집계는 가드가 401 로 끊는 요청에도 걸려야 하므로 미들웨어입니다.
  // 실제 집계는 응답이 끝난 뒤 상태 코드를 보고 합니다 (미들웨어 주석 참고).
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TechArticleViewMiddleware)
      // 이 둘도 :articleId 자리에 들어와 조회수가 잘못 오릅니다.
      .exclude('api/v1/tech-articles/tags', 'api/v1/tech-articles/sources')
      .forRoutes({
        path: 'api/v1/tech-articles/:articleId',
        method: RequestMethod.GET,
      });
  }
}
