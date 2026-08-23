import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ArticleIdParamDto, PublicArticleQueryDto } from './tech-articles.dto';
import { TechArticlesService } from './tech-articles.service';

@Controller('api/v1/tech-articles')
export class TechArticlesController {
  constructor(private readonly service: TechArticlesService) {}

  @Get()
  list(@Query() query: PublicArticleQueryDto) {
    return this.service.listPublic(query);
  }

  @Get('tags')
  tags() {
    return this.service.tags();
  }

  @Get('sources')
  sources() {
    return this.service.sources();
  }

  @Get(':articleId')
  @UseGuards(JwtAuthGuard)
  detail(@Param() params: ArticleIdParamDto) {
    return this.service.publicDetail(params.articleId);
  }
}
