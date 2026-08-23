import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../members/entities/enums/user-role.enum';
import {
  AdminArticleQueryDto,
  AdminArticleStatsQueryDto,
  ArticleIdParamDto,
  BulkDuplicateResolutionDto,
  BulkPublicationDto,
  BulkQualityResolutionDto,
  CrawlRunDto,
  CrawlRunIdParamDto,
  CrawlRunQueryDto,
  DuplicateResolutionDto,
  DuplicateReviewQueryDto,
  ProcessingReviewQueryDto,
  PublicationActionDto,
  PublicationPolicyDto,
  QualityResolutionDto,
  ReviewCaseIdParamDto,
} from './tech-articles.dto';
import { TechArticlesService } from './tech-articles.service';

interface AdminRequest extends Request {
  user: { userId: string };
}

@Controller('api/v1/admin/tech-articles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminTechArticlesController {
  constructor(private readonly service: TechArticlesService) {}

  @Get()
  list(@Query() query: AdminArticleQueryDto) {
    return this.service.listAdmin(query);
  }

  @Get('stats')
  stats(@Query() query: AdminArticleStatsQueryDto) {
    return this.service.stats(query);
  }

  @Get('reviews/duplicates')
  duplicateReviews(@Query() query: DuplicateReviewQueryDto) {
    return this.service.reviews('duplicate', query);
  }

  @Get('reviews/quality')
  qualityReviews(@Query() query: ProcessingReviewQueryDto) {
    return this.service.reviews('quality', query);
  }

  @Get('reviews/publication')
  publicationReviews(@Query() query: ProcessingReviewQueryDto) {
    return this.service.reviews('publication', query);
  }

  @Post('reviews/duplicates/resolutions/bulk')
  @HttpCode(HttpStatus.OK)
  bulkDuplicate(
    @Body() dto: BulkDuplicateResolutionDto,
    @Req() request: AdminRequest,
  ) {
    return this.service.bulkDuplicate(dto, request.user.userId);
  }

  @Post('reviews/duplicates/:caseId/resolutions')
  @HttpCode(HttpStatus.OK)
  duplicateResolution(
    @Param() params: ReviewCaseIdParamDto,
    @Body() dto: DuplicateResolutionDto,
    @Req() request: AdminRequest,
  ) {
    return this.service.duplicateResolution(
      params.caseId,
      dto,
      request.user.userId,
    );
  }

  @Post('reviews/quality/resolutions/bulk')
  @HttpCode(HttpStatus.OK)
  bulkQuality(
    @Body() dto: BulkQualityResolutionDto,
    @Req() request: AdminRequest,
  ) {
    return this.service.bulkQuality(dto, request.user.userId);
  }

  @Post('reviews/quality/:caseId/resolutions')
  @HttpCode(HttpStatus.OK)
  qualityResolution(
    @Param() params: ReviewCaseIdParamDto,
    @Body() dto: QualityResolutionDto,
    @Req() request: AdminRequest,
  ) {
    return this.service.qualityResolution(
      params.caseId,
      dto,
      request.user.userId,
    );
  }

  @Get('publication-policy')
  publicationPolicy() {
    return this.service.publicationPolicy();
  }

  @Patch('publication-policy')
  updatePublicationPolicy(@Body() dto: PublicationPolicyDto) {
    return this.service.updatePublicationPolicy(dto);
  }

  @Get('crawl-sources')
  crawlSources() {
    return this.service.crawlSources();
  }

  @Post('crawl-runs')
  @HttpCode(HttpStatus.ACCEPTED)
  startCrawl(
    @Body() dto: CrawlRunDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.service.startCrawl(dto, idempotencyKey);
  }

  @Get('crawl-runs')
  crawlRuns(@Query() query: CrawlRunQueryDto) {
    return this.service.crawlRuns(query);
  }

  @Get('crawl-runs/:crawlRunId')
  crawlRun(@Param() params: CrawlRunIdParamDto) {
    return this.service.crawlRun(params.crawlRunId);
  }

  @Post('publication-actions/bulk')
  @HttpCode(HttpStatus.OK)
  bulkPublication(
    @Body() dto: BulkPublicationDto,
    @Req() request: AdminRequest,
  ) {
    return this.service.bulkPublication(dto, request.user.userId);
  }

  @Post(':articleId/publication-actions')
  @HttpCode(HttpStatus.OK)
  publicationAction(
    @Param() params: ArticleIdParamDto,
    @Body() dto: PublicationActionDto,
    @Req() request: AdminRequest,
  ) {
    return this.service.publicationAction(
      params.articleId,
      dto,
      request.user.userId,
    );
  }

  @Get(':articleId')
  detail(@Param() params: ArticleIdParamDto) {
    return this.service.adminDetail(params.articleId);
  }
}
