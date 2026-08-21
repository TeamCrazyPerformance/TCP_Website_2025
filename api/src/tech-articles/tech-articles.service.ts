import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AdminArticleQueryDto,
  BulkDuplicateResolutionDto,
  BulkPublicationDto,
  BulkQualityResolutionDto,
  CrawlRunDto,
  DuplicateResolutionDto,
  PageQueryDto,
  PublicationActionDto,
  PublicationPolicyDto,
  PublicArticleQueryDto,
  QualityResolutionDto,
} from './tech-articles.dto';
import { TechArticlePipelineClient } from './tech-article-pipeline.client';

export interface SourceProjection {
  id?: string;
  name?: string;
  type?: string;
  domain?: string | null;
  path?: string;
  articleUrl?: string | null;
}

export interface LanguageProjection {
  code: string;
  label: string;
}

export interface QualityEvaluation {
  decision?: string | null;
  reason?: string | null;
  signals?: Record<string, unknown> | null;
  score?: {
    overall?: number | null;
    dimensions?: {
      relevance?: number | null;
      timeliness?: number | null;
      sourceReliability?: number | null;
    };
  } | null;
}

interface PipelineArticle {
  articleId: string;
  recordVersion?: number;
  title?: string | null;
  localizedTitle?: string | null;
  authors?: string[];
  oneLineSummary?: string | null;
  summaryMarkdown?: string | null;
  summary?: string | null;
  tags?: string[];
  source?: SourceProjection | null;
  canonicalUrl?: string | null;
  articleUrl?: string | null;
  originalLanguage?: LanguageProjection | null;
  originalPublishedAt?: string | null;
  collectedAt?: string | null;
  normalizedAt?: string | null;
  qualityScore?: number | null;
  valueScore?: number | null;
  qualityDecision?: string | null;
  evaluation?: QualityEvaluation | null;
  processingStatus?: string;
  duplicateStatus?: string;
  reviewStatus?: string;
  publicationStatus?: string;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface DuplicateCandidateEvidence {
  articleId?: string;
  matchedBy?: string[];
  contentJaccard?: number;
  minHashSimilarity?: number;
  titleSimilarity?: number | null;
  article?: PipelineArticle | null;
}

interface DuplicateReviewItem {
  reviewCaseId: string;
  caseVersion: number;
  crawlRunId?: string;
  crawlItemId?: string;
  candidate?: Record<string, unknown>;
  candidates?: DuplicateCandidateEvidence[];
  createdAt?: string;
}

interface QualityReviewItem {
  caseId: string;
  caseVersion: number;
  articleId: string;
  title?: string | null;
  localizedTitle?: string | null;
  source?: SourceProjection | null;
  originalLanguage?: LanguageProjection | null;
  originalPublishedAt?: string | null;
  evaluation?: QualityEvaluation | null;
  createdAt?: string;
}

interface DuplicateResolutionResult {
  outcome?: string;
  resolution?: Record<string, unknown>;
  articleIngested?: {
    articleId?: string;
    recordVersion?: number;
    workflow?: Record<string, unknown>;
  };
}

type PipelineReviewItem =
  | DuplicateReviewItem
  | QualityReviewItem
  | PipelineArticle;

interface PipelinePage<T> {
  items: T[];
  totalCount: number;
  lastCrawledAt?: string | null;
}

export interface BulkResult {
  id: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  data?: unknown;
  error?: unknown;
}

type ReviewKind = 'duplicate' | 'quality' | 'publication';

@Injectable()
export class TechArticlesService {
  private readonly bulkConcurrency = 5;

  constructor(private readonly pipeline: TechArticlePipelineClient) {}

  async listPublic(query: PublicArticleQueryDto) {
    const upstream = await this.pipeline.get<PipelinePage<PipelineArticle>>(
      '/internal/v1/public/articles',
      {
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
        keyword: query.keyword,
        tags: query.tags,
      },
    );
    return {
      items: upstream.items.map((article) => this.publicItem(article)),
      pagination: this.pagination(
        upstream.totalCount,
        query.page,
        query.pageSize,
      ),
      lastCrawledAt: upstream.lastCrawledAt ?? null,
    };
  }

  async tags() {
    return this.pipeline.get<{ items: string[] }>('/internal/v1/public/tags');
  }

  async publicDetail(articleId: string) {
    const article = await this.pipeline.get<PipelineArticle>(
      `/internal/v1/public/articles/${encodeURIComponent(articleId)}`,
    );
    return this.publicDetailItem(article);
  }

  async listAdmin(query: AdminArticleQueryDto) {
    const upstream = await this.pipeline.get<PipelinePage<PipelineArticle>>(
      '/internal/v1/admin/articles',
      {
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
        keyword: query.keyword,
        publicationStatus: query.publicationStatus,
        stage: query.stage,
        statusMismatch: query.statusMismatch || undefined,
        sort: query.sort,
      },
    );
    return {
      items: upstream.items.map((article) => this.adminItem(article)),
      pagination: this.pagination(
        upstream.totalCount,
        query.page,
        query.pageSize,
      ),
    };
  }

  stats() {
    return this.pipeline.get('/internal/v1/admin/articles/stats');
  }

  async adminDetail(articleId: string) {
    const article = await this.pipeline.get<PipelineArticle>(
      `/internal/v1/admin/articles/${encodeURIComponent(articleId)}`,
    );
    return this.adminItem(article);
  }

  async reviews(
    kind: ReviewKind,
    query: PageQueryDto & { filter?: string; sort: string },
  ) {
    const upstream = await this.pipeline.get<PipelinePage<PipelineReviewItem>>(
      `/internal/v1/admin/reviews/${kind}`,
      {
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
        keyword: query.keyword,
        filter: query.filter,
        sort: query.sort,
      },
    );
    return {
      items: upstream.items.map((item) => this.reviewItem(kind, item)),
      pagination: this.pagination(
        upstream.totalCount,
        query.page,
        query.pageSize,
      ),
    };
  }

  async publicationAction(
    articleId: string,
    dto: PublicationActionDto,
    administratorId: string,
  ) {
    const result = await this.pipeline.post<PipelineArticle>(
      `/internal/v1/admin/articles/${encodeURIComponent(articleId)}/publication`,
      {
        action: dto.action,
        expectedRecordVersion: dto.expectedRecordVersion,
        administratorId,
        reason: dto.reason,
      },
    );
    return {
      articleId: result.articleId,
      publicationStatus: result.publicationStatus,
      reviewStatus: result.reviewStatus,
      recordVersion: result.recordVersion,
    };
  }

  bulkPublication(dto: BulkPublicationDto, administratorId: string) {
    return this.runBulk(
      dto.items,
      (item) => item.articleId,
      (item) => this.publicationAction(item.articleId, item, administratorId),
    );
  }

  async duplicateResolution(
    caseId: string,
    dto: DuplicateResolutionDto,
    administratorId: string,
  ) {
    if (dto.action === 'APPROVE_UNIQUE' && dto.matchedArticleId !== undefined) {
      throw new BadRequestException(
        'APPROVE_UNIQUE에는 matchedArticleId를 사용할 수 없습니다.',
      );
    }
    const result = await this.pipeline.post<DuplicateResolutionResult>(
      `/internal/v1/admin/reviews/duplicate/${encodeURIComponent(caseId)}/resolution`,
      {
        schemaVersion: '1.0',
        resolutionRequestId: `resolution-${randomUUID().replaceAll('-', '')}`,
        reviewCaseId: caseId,
        expectedCaseVersion: dto.expectedCaseVersion,
        action: dto.action,
        matchedArticleId: dto.matchedArticleId ?? null,
        administratorId,
        resolvedAt: new Date().toISOString(),
      },
    );
    return {
      outcome: result.outcome,
      resolution: result.resolution,
      article: result.articleIngested
        ? {
            articleId: result.articleIngested.articleId,
            recordVersion: result.articleIngested.recordVersion,
            workflow: result.articleIngested.workflow,
          }
        : null,
    };
  }

  bulkDuplicate(dto: BulkDuplicateResolutionDto, administratorId: string) {
    return this.runBulk(
      dto.items,
      (item) => item.caseId,
      (item) => this.duplicateResolution(item.caseId, item, administratorId),
    );
  }

  async qualityResolution(
    caseId: string,
    dto: QualityResolutionDto,
    administratorId: string,
  ) {
    const result = await this.pipeline.post<{
      caseId?: string;
      status?: string;
      caseVersion?: number;
      articleId?: string;
    }>(
      `/internal/v1/admin/reviews/quality/${encodeURIComponent(caseId)}/resolution`,
      {
        action: dto.action,
        expectedCaseVersion: dto.expectedCaseVersion,
        administratorId,
      },
    );
    return {
      caseId: result.caseId ?? caseId,
      status: result.status,
      caseVersion: result.caseVersion,
      articleId: result.articleId,
    };
  }

  bulkQuality(dto: BulkQualityResolutionDto, administratorId: string) {
    return this.runBulk(
      dto.items,
      (item) => item.caseId,
      (item) => this.qualityResolution(item.caseId, item, administratorId),
    );
  }

  publicationPolicy() {
    return this.pipeline.get('/internal/v1/admin/settings/publication-policy');
  }

  updatePublicationPolicy(dto: PublicationPolicyDto) {
    return this.pipeline.patch(
      '/internal/v1/admin/settings/publication-policy',
      dto,
    );
  }

  crawlSources() {
    return this.pipeline.get('/internal/v1/admin/crawl-sources');
  }

  startCrawl(dto: CrawlRunDto, idempotencyKey: string | undefined) {
    if (!idempotencyKey || !/^[\x21-\x7e]{1,255}$/.test(idempotencyKey)) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: '유효한 Idempotency-Key 헤더가 필요합니다.',
      });
    }
    this.validateCrawlSource(dto);
    const request =
      dto.source.sourceId === 'github-trending'
        ? {
            ...dto,
            crawlOptions: {
              ...dto.crawlOptions,
              maximumArticleCount:
                dto.crawlOptions?.maximumArticleCount ?? 3,
            },
          }
        : dto;
    return this.pipeline.post('/internal/v1/crawl-runs', request, {
      'Idempotency-Key': idempotencyKey,
    });
  }

  crawlRun(crawlRunId: string) {
    return this.pipeline.get(
      `/internal/v1/crawl-runs/${encodeURIComponent(crawlRunId)}`,
    );
  }

  private validateCrawlSource(dto: CrawlRunDto): void {
    const allowed: Record<string, string[]> = {
      'cloudflare-blog': ['RSS:BLOG'],
      infoq: [
        'RSS:NEWS',
        'RSS:ENGINEERING',
        'WEB_CRAWL:NEWS',
        'WEB_CRAWL:ENGINEERING',
      ],
      sdtimes: ['RSS:NEWS', 'WEB_CRAWL:NEWS', 'API:NEWS'],
      'github-trending': ['WEB_CRAWL:REPOSITORIES'],
    };
    const capability = `${dto.source.sourceType}:${dto.source.sectionKey}`;
    if (!allowed[dto.source.sourceId].includes(capability)) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'UNSUPPORTED_CRAWL_SOURCE',
        message: '지원하지 않는 수집 소스 조합입니다.',
      });
    }
    if (
      dto.crawlOptions?.followPagination &&
      capability !== 'WEB_CRAWL:NEWS' &&
      capability !== 'WEB_CRAWL:ENGINEERING'
    ) {
      throw new BadRequestException(
        'followPagination은 WEB_CRAWL 방식에서만 사용할 수 있습니다.',
      );
    }
    if (dto.crawlOptions?.followPagination && dto.source.sourceId !== 'infoq') {
      throw new BadRequestException(
        'followPagination은 infoq 소스에서만 지원합니다.',
      );
    }
    if (
      dto.source.sourceId === 'github-trending' &&
      (dto.crawlOptions?.maximumArticleCount ?? 3) > 3
    ) {
      throw new BadRequestException(
        'github-trending은 최대 3개 저장소만 수집할 수 있습니다.',
      );
    }
    if (
      dto.source.sourceId === 'github-trending' &&
      dto.crawlOptions?.maximumPageCount !== undefined &&
      dto.crawlOptions.maximumPageCount !== 1
    ) {
      throw new BadRequestException(
        'github-trending은 페이지네이션을 지원하지 않습니다.',
      );
    }
  }

  private pagination(
    totalCount: number,
    currentPage: number,
    pageSize: number,
  ) {
    return {
      totalCount,
      currentPage,
      totalPages: Math.ceil(totalCount / pageSize),
      pageSize,
    };
  }

  private publicItem(article: PipelineArticle) {
    return {
      id: article.articleId,
      title: article.localizedTitle || article.title,
      oneLineSummary: article.oneLineSummary,
      tags: article.tags ?? [],
      source: article.source,
      originalLanguage: article.originalLanguage,
      originalPublishedAt: article.originalPublishedAt,
      collectedAt: article.collectedAt,
      score: article.qualityScore,
    };
  }

  private publicDetailItem(article: PipelineArticle) {
    const evaluation = article.evaluation ?? {};
    const score = evaluation.score ?? {};
    const dimensions = score.dimensions ?? {};
    return {
      ...this.publicItem(article),
      authors: article.authors ?? [],
      summaryMarkdown: article.summaryMarkdown ?? article.summary,
      evaluation: {
        decision: evaluation.decision ?? article.qualityDecision,
        reason: evaluation.reason ?? null,
        signals: evaluation.signals ?? null,
        score: {
          overall: score.overall ?? article.qualityScore,
          relevance: dimensions.relevance ?? null,
          timeliness: dimensions.timeliness ?? null,
          sourceReliability: dimensions.sourceReliability ?? null,
        },
      },
    };
  }

  private adminItem(article: PipelineArticle) {
    return {
      articleId: article.articleId,
      recordVersion: article.recordVersion,
      title: article.localizedTitle || article.title,
      originalTitle: article.title,
      authors: article.authors ?? [],
      oneLineSummary: article.oneLineSummary,
      summaryMarkdown: article.summaryMarkdown ?? article.summary,
      tags: article.tags ?? [],
      source: article.source,
      canonicalUrl: article.canonicalUrl,
      originalLanguage: article.originalLanguage,
      valueScore: article.valueScore ?? article.qualityScore,
      qualityDecision:
        article.qualityDecision ?? article.evaluation?.decision ?? null,
      evaluation: article.evaluation ?? null,
      originalPublishedAt: article.originalPublishedAt,
      crawledAt: article.collectedAt,
      normalizedAt: article.normalizedAt,
      processingStatus: article.processingStatus,
      duplicateStatus: article.duplicateStatus,
      reviewStatus: article.reviewStatus,
      publicationStatus: article.publicationStatus,
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }

  private reviewItem(kind: ReviewKind, item: PipelineReviewItem) {
    if (kind === 'duplicate') {
      const duplicate = item as DuplicateReviewItem;
      const candidates = (duplicate.candidates ?? []).map((candidate) => ({
        articleId: candidate.articleId,
        matchedBy: candidate.matchedBy ?? [],
        contentJaccard: candidate.contentJaccard,
        minHashSimilarity: candidate.minHashSimilarity,
        titleSimilarity: candidate.titleSimilarity ?? null,
        article: candidate.article
          ? {
              articleId: candidate.article.articleId,
              title: candidate.article.title,
              source: candidate.article.source,
              articleUrl:
                candidate.article.articleUrl ?? candidate.article.canonicalUrl,
              originalLanguage: candidate.article.originalLanguage,
              originalPublishedAt: candidate.article.originalPublishedAt,
            }
          : null,
      }));
      const topMatch = candidates[0] ?? null;
      return {
        reviewCaseId: duplicate.reviewCaseId,
        caseVersion: duplicate.caseVersion,
        crawlRunId: duplicate.crawlRunId,
        crawlItemId: duplicate.crawlItemId,
        candidate: duplicate.candidate,
        candidates,
        matched: topMatch?.article ?? null,
        matchType: topMatch?.matchedBy?.[0] ?? null,
        jaccardCoefficient: topMatch?.contentJaccard ?? null,
        queuedAt: duplicate.createdAt,
      };
    }
    if (kind === 'quality') {
      const quality = item as QualityReviewItem;
      return {
        caseId: quality.caseId,
        caseVersion: quality.caseVersion,
        articleId: quality.articleId,
        title: quality.localizedTitle || quality.title,
        source: quality.source,
        originalLanguage: quality.originalLanguage,
        originalPublishedAt: quality.originalPublishedAt,
        evaluation: quality.evaluation,
        valueScore: quality.evaluation?.score?.overall ?? null,
        reason: quality.evaluation?.reason ?? null,
        signals: quality.evaluation?.signals ?? null,
        queuedAt: quality.createdAt,
      };
    }
    return this.adminItem(item as PipelineArticle);
  }

  private async runBulk<T>(
    items: T[],
    id: (item: T) => string,
    action: (item: T) => Promise<unknown>,
  ) {
    const results: BulkResult[] = items.map((item) => ({
      id: id(item),
      status: 'PENDING',
    }));
    let cursor = 0;
    const worker = async () => {
      while (cursor < items.length) {
        const index = cursor++;
        const item = items[index];
        try {
          results[index] = {
            id: id(item),
            status: 'SUCCEEDED',
            data: await action(item),
          };
        } catch (error) {
          results[index] = {
            id: id(item),
            status: 'FAILED',
            error: this.bulkError(error),
          };
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(this.bulkConcurrency, items.length) }, () =>
        worker(),
      ),
    );
    const succeeded = results.filter(
      (item) => item.status === 'SUCCEEDED',
    ).length;
    return {
      results,
      summary: {
        total: items.length,
        succeeded,
        failed: items.length - succeeded,
      },
    };
  }

  private bulkError(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'object') return response;
      return { statusCode: error.getStatus(), message: response };
    }
    return {
      statusCode: 503,
      code: 'TECH_ARTICLE_PIPELINE_UNAVAILABLE',
      message: '기술 아티클 서비스를 일시적으로 사용할 수 없습니다.',
    };
  }
}
