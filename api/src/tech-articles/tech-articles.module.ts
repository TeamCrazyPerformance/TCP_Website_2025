import { Module } from '@nestjs/common';
import { AdminTechArticlesController } from './admin-tech-articles.controller';
import { TechArticleCrawlScheduler } from './tech-article-crawl.scheduler';
import { TechArticlePipelineClient } from './tech-article-pipeline.client';
import { TechArticlesController } from './tech-articles.controller';
import { TechArticlesService } from './tech-articles.service';

@Module({
  controllers: [TechArticlesController, AdminTechArticlesController],
  providers: [
    TechArticlePipelineClient,
    TechArticlesService,
    TechArticleCrawlScheduler,
  ],
})
export class TechArticlesModule {}
