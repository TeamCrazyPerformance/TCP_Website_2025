import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
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
  @UseGuards(OptionalJwtAuthGuard)
  detail(
    @Param() params: ArticleIdParamDto,
    @Req() request: Request & { user?: unknown },
    @Res({ passthrough: true }) response: Response,
  ) {
    // CORS가 설정한 Vary: Origin을 덮지 않고 Authorization을 병합합니다.
    response.vary('Authorization');
    // 브라우저의 ETag 재검증(304)은 유지하되 공유 캐시에는 저장하지 않습니다.
    response.setHeader('Cache-Control', 'private, no-cache');
    return this.service.publicDetail(params.articleId, Boolean(request.user));
  }
}
