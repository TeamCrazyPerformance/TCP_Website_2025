/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TechArticlePipelineClient } from './tech-article-pipeline.client';
import { TechArticlesService } from './tech-articles.service';

describe('TechArticlesService', () => {
  let pipeline: jest.Mocked<TechArticlePipelineClient>;
  let service: TechArticlesService;

  beforeEach(() => {
    pipeline = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
    } as unknown as jest.Mocked<TechArticlePipelineClient>;
    service = new TechArticlesService(pipeline);
  });

  it('returns only public teaser fields', async () => {
    pipeline.get.mockResolvedValue({
      totalCount: 1,
      lastCrawledAt: null,
      items: [
        {
          articleId: 'article-1',
          title: 'original',
          localizedTitle: '제목',
          oneLineSummary: '한 줄',
          tags: ['AI'],
          source: { id: 'infoq' },
          originalLanguage: { code: 'en', label: '영어' },
          qualityScore: 90,
          content: 'must-not-leak',
          localizedContent: 'must-not-leak-either',
        },
      ],
    });

    const result = await service.listPublic({
      page: 1,
      pageSize: 20,
      tags: [],
      sources: [],
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({ id: 'article-1', title: '제목' }),
    );
    expect(result.items[0]).not.toHaveProperty('score');
    expect(result.items[0]).not.toHaveProperty('content');
    expect(result.items[0]).not.toHaveProperty('localizedContent');
  });

  it('returns article content without evaluation to a guest', async () => {
    pipeline.get.mockResolvedValue({
      articleId: 'article-1',
      localizedTitle: '공개 제목',
      summaryMarkdown: '## 공개 요약',
      qualityScore: 88,
      evaluation: {
        decision: 'PASS',
        score: { overall: 88 },
      },
    });

    const result = await service.publicDetail('article-1', false);

    expect(result).toEqual(
      expect.objectContaining({
        title: '공개 제목',
        summaryMarkdown: '## 공개 요약',
      }),
    );
    expect(result).not.toHaveProperty('evaluation');
  });

  it('returns server supplied score axes to a member', async () => {
    pipeline.get.mockResolvedValue({
      articleId: 'article-1',
      title: 'title',
      qualityScore: 88,
      evaluation: {
        schemaVersion: '2.0',
        decision: 'PASS',
        score: {
          overall: 88,
          axes: [
            {
              key: 'usefulness',
              label: '실무 활용성',
              value: 92,
              weight: 0.4,
              contribution: 36.8,
            },
          ],
        },
      },
    });

    const result = await service.publicDetail('article-1', true);

    expect(
      (result as { evaluation?: { score?: unknown } }).evaluation?.score,
    ).toEqual(
      expect.objectContaining({
        overall: 88,
        axes: [expect.objectContaining({ key: 'usefulness' })],
      }),
    );
  });

  it('keeps bulk output ordered and reports item failures', async () => {
    pipeline.post
      .mockResolvedValueOnce({ articleId: 'a', recordVersion: 2 })
      .mockRejectedValueOnce(
        new ConflictException({ code: 'VERSION_CONFLICT' }),
      );

    const result = await service.bulkPublication(
      {
        items: [
          {
            articleId: 'a',
            action: 'HIDE',
            expectedRecordVersion: 1,
            reason: '',
          },
          {
            articleId: 'b',
            action: 'HIDE',
            expectedRecordVersion: 1,
            reason: '',
          },
        ],
      },
      'admin-1',
    );

    expect(result.results.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result.summary).toEqual({ total: 2, succeeded: 1, failed: 1 });
  });

  it('injects the authenticated administrator into publication commands', async () => {
    pipeline.post.mockResolvedValue({
      articleId: 'article-1',
      publicationStatus: 'ARCHIVED',
      recordVersion: 4,
      content: 'must-not-leak',
    });
    const result = await service.publicationAction(
      'article-1',
      { action: 'ARCHIVE', expectedRecordVersion: 3, reason: 'expired' },
      'member-7',
    );
    expect(pipeline.post).toHaveBeenCalledWith(
      '/internal/v1/admin/articles/article-1/publication',
      expect.objectContaining({
        administratorId: 'member-7',
        action: 'ARCHIVE',
      }),
    );
    expect(result).not.toHaveProperty('content');
  });

  it('removes the admitted source article from duplicate resolution responses', async () => {
    pipeline.post.mockResolvedValue({
      outcome: 'RESOLUTION_COMPLETED',
      resolution: { finalDecision: 'UNIQUE' },
      articleIngested: {
        articleId: 'article-new',
        recordVersion: 1,
        article: { title: 'raw', content: 'must-not-leak' },
        workflow: { processingStatus: 'INGESTED' },
      },
    });

    const result = await service.duplicateResolution(
      'case-1',
      { action: 'APPROVE_UNIQUE', expectedCaseVersion: 1 },
      'admin-1',
    );

    expect(result.article).toEqual(
      expect.objectContaining({ articleId: 'article-new', recordVersion: 1 }),
    );
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  it('forwards a valid GitHub Trending crawl request', async () => {
    pipeline.post.mockResolvedValue({ crawlRunId: 'crawl-github-1' });
    const dto = {
      source: {
        sourceId: 'github-trending' as const,
        sourceType: 'WEB_CRAWL' as const,
        sectionKey: 'REPOSITORIES' as const,
      },
      crawlOptions: {
        maximumArticleCount: 3,
        requestTimeoutMs: 15000,
      },
    };

    await service.startCrawl(dto, 'manual-github-1');

    expect(pipeline.post).toHaveBeenCalledWith('/internal/v1/crawl-runs', dto, {
      'Idempotency-Key': 'manual-github-1',
      'X-Crawl-Trigger': 'MANUAL',
    });
  });

  it('returns paginated crawl history with operational filters', async () => {
    pipeline.get.mockResolvedValue({
      items: [
        {
          crawlRunId: 'crawl-1',
          status: 'RUNNING',
          requestPayload: { rawArticle: { content: 'must-not-leak' } },
          error: {
            code: 'SOURCE_CRAWL_FAILED',
            message: 'failed',
            retryable: true,
            details: { crawlItems: [{ rawArticle: 'must-not-leak' }] },
          },
          job: {
            status: 'RETRY',
            result: { rawArticle: 'must-not-leak' },
            leaseToken: 'must-not-leak',
          },
        },
      ],
      totalCount: 21,
    });

    const result = await service.crawlRuns({
      page: 2,
      pageSize: 20,
      status: 'RUNNING',
      sourceId: 'infoq',
      trigger: 'SCHEDULED',
    });

    expect(pipeline.get).toHaveBeenCalledWith('/internal/v1/crawl-runs', {
      limit: 20,
      offset: 20,
      status: 'RUNNING',
      sourceId: 'infoq',
      trigger: 'SCHEDULED',
    });
    expect(result.pagination).toEqual({
      totalCount: 21,
      currentPage: 2,
      totalPages: 2,
      pageSize: 20,
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(result.items[0].error).toEqual({
      code: 'SOURCE_CRAWL_FAILED',
      message: 'failed',
      retryable: true,
    });
  });

  it('defaults a GitHub Trending crawl request to three repositories', async () => {
    pipeline.post.mockResolvedValue({ crawlRunId: 'crawl-github-default' });

    await service.startCrawl(
      {
        source: {
          sourceId: 'github-trending',
          sourceType: 'WEB_CRAWL',
          sectionKey: 'REPOSITORIES',
        },
      },
      'manual-github-default',
    );

    expect(pipeline.post).toHaveBeenCalledWith(
      '/internal/v1/crawl-runs',
      {
        source: {
          sourceId: 'github-trending',
          sourceType: 'WEB_CRAWL',
          sectionKey: 'REPOSITORIES',
        },
        crawlOptions: { maximumArticleCount: 3 },
      },
      {
        'Idempotency-Key': 'manual-github-default',
        'X-Crawl-Trigger': 'MANUAL',
      },
    );
  });

  it('removes internal crawl evidence from crawl details', async () => {
    pipeline.get.mockResolvedValue({
      crawlRunId: 'crawl-1',
      status: 'FAILED',
      requestPayload: { rawArticle: 'must-not-leak' },
      error: {
        code: 'SOURCE_CRAWL_FAILED',
        message: 'failed',
        retryable: false,
        details: { crawlItems: [{ rawArticle: 'must-not-leak' }] },
      },
      job: {
        status: 'DEAD',
        result: { rawArticle: 'must-not-leak' },
        error: {
          code: 'SOURCE_CRAWL_FAILED',
          message: 'failed',
          retryable: false,
        },
      },
      items: [
        {
          crawlItemId: 'item-1',
          crawlStatus: 'FAILED',
          rawArticle: 'must-not-leak',
        },
      ],
    });

    const result = await service.crawlRun('crawl-1');

    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(result.items).toEqual([
      {
        crawlItemId: 'item-1',
        crawlStatus: 'FAILED',
        submissionId: undefined,
        normalizationStatus: undefined,
      },
    ]);
  });

  it.each([
    {
      source: {
        sourceId: 'github-trending' as const,
        sourceType: 'RSS' as const,
        sectionKey: 'REPOSITORIES' as const,
      },
      crawlOptions: { maximumArticleCount: 3 },
    },
    {
      source: {
        sourceId: 'github-trending' as const,
        sourceType: 'WEB_CRAWL' as const,
        sectionKey: 'REPOSITORIES' as const,
      },
      crawlOptions: { maximumArticleCount: 4 },
    },
    {
      source: {
        sourceId: 'github-trending' as const,
        sourceType: 'WEB_CRAWL' as const,
        sectionKey: 'REPOSITORIES' as const,
      },
      crawlOptions: { maximumArticleCount: 3, followPagination: true },
    },
    {
      source: {
        sourceId: 'github-trending' as const,
        sourceType: 'WEB_CRAWL' as const,
        sectionKey: 'REPOSITORIES' as const,
      },
      crawlOptions: { maximumArticleCount: 3, maximumPageCount: 2 },
    },
  ])('rejects an unsupported GitHub Trending request', (dto) => {
    expect(() => service.startCrawl(dto, 'manual-github-invalid')).toThrow(
      BadRequestException,
    );
    expect(pipeline.post).not.toHaveBeenCalled();
  });
});
