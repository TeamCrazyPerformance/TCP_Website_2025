/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException } from '@nestjs/common';
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
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({ id: 'article-1', title: '제목', score: 90 }),
    );
    expect(result.items[0]).not.toHaveProperty('content');
    expect(result.items[0]).not.toHaveProperty('localizedContent');
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
});
