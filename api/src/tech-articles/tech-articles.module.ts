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
  // 응답이 끝난 뒤에 세야 가드와 컨트롤러의 최종 판정을 볼 수 있어 미들웨어입니다.
  // 집계는 상태 코드와 가드가 res.locals 에 기록한 회원 여부를 함께 보고 합니다.
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
