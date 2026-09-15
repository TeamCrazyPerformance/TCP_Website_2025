import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminArticleQueryDto,
  ArticleReprocessingDto,
  BulkPublicationDto,
  BulkSummaryRegenerationDto,
  CrawlRunDto,
  PublicArticleQueryDto,
} from './tech-articles.dto';

describe('tech article DTO validation', () => {
  it('normalizes a single repeated-query tag value to an array', async () => {
    const dto = plainToInstance(PublicArticleQueryDto, {
      page: '1',
      pageSize: '20',
      tags: 'AI',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.tags).toEqual(['AI']);
  });

  it('rejects duplicate and oversized bulk inputs', async () => {
    const duplicate = plainToInstance(BulkPublicationDto, {
      items: [
        { articleId: 'a', action: 'HIDE', expectedRecordVersion: 1 },
        { articleId: 'a', action: 'ARCHIVE', expectedRecordVersion: 2 },
      ],
    });
    expect(await validate(duplicate)).not.toHaveLength(0);

    const oversized = plainToInstance(BulkPublicationDto, {
      items: Array.from({ length: 51 }, (_, index) => ({
        articleId: `article-${index}`,
        action: 'HIDE',
        expectedRecordVersion: 1,
      })),
    });
    expect(await validate(oversized)).not.toHaveLength(0);
  });

  it('accepts the GitHub Trending source literals', async () => {
    const dto = plainToInstance(CrawlRunDto, {
      source: {
        sourceId: 'github-trending',
        sourceType: 'WEB_CRAWL',
        sectionKey: 'REPOSITORIES',
      },
      crawlOptions: {
        maximumArticleCount: 3,
        requestTimeoutMs: 15000,
      },
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    ['tailscale-blog', 'BLOG'],
    ['rust-blog', 'BLOG'],
    ['hugging-face-blog', 'BLOG'],
    ['deepmind-blog', 'BLOG'],
  ])('accepts the new RSS source literal %s', async (sourceId, sectionKey) => {
    const dto = plainToInstance(CrawlRunDto, {
      source: { sourceId, sourceType: 'RSS', sectionKey },
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects Apple Newsroom as a crawl source', async () => {
    const dto = plainToInstance(CrawlRunDto, {
      source: {
        sourceId: 'apple-newsroom',
        sourceType: 'RSS',
        sectionKey: 'NEWS',
      },
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('accepts only supported article reprocessing actions', async () => {
    const retry = plainToInstance(ArticleReprocessingDto, {
      action: 'RETRY',
      expectedRecordVersion: 3,
    });
    const invalid = plainToInstance(ArticleReprocessingDto, {
      action: 'PUBLISH',
      expectedRecordVersion: 0,
    });

    expect(await validate(retry)).toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });

  it('accepts outdated and untracked applied-version filters', async () => {
    for (const status of ['OUTDATED', 'UNTRACKED']) {
      const dto = plainToInstance(AdminArticleQueryDto, {
        qualityVersionStatus: status,
        summaryVersionStatus: status,
      });
      expect(await validate(dto)).toHaveLength(0);
    }

    const invalid = plainToInstance(AdminArticleQueryDto, {
      summaryVersionStatus: 'CURRENT',
    });
    expect(await validate(invalid)).not.toHaveLength(0);
  });

  it('accepts only supported quality recalculation result filters', async () => {
    for (const status of ['PASS', 'ATTENTION_REQUIRED']) {
      const dto = plainToInstance(AdminArticleQueryDto, {
        qualityRecalculationStatus: status,
      });
      expect(await validate(dto)).toHaveLength(0);
    }

    const invalid = plainToInstance(AdminArticleQueryDto, {
      qualityRecalculationStatus: 'REJECT',
    });
    expect(await validate(invalid)).not.toHaveLength(0);
  });

  it('validates summary regeneration versions and unique bulk article ids', async () => {
    const valid = plainToInstance(BulkSummaryRegenerationDto, {
      items: [
        { articleId: 'article-1', expectedRecordVersion: 3 },
        { articleId: 'article-2', expectedRecordVersion: 1 },
      ],
    });
    const duplicate = plainToInstance(BulkSummaryRegenerationDto, {
      items: [
        { articleId: 'article-1', expectedRecordVersion: 3 },
        { articleId: 'article-1', expectedRecordVersion: 4 },
      ],
    });
    const invalidVersion = plainToInstance(BulkSummaryRegenerationDto, {
      items: [{ articleId: 'article-1', expectedRecordVersion: 0 }],
    });

    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(duplicate)).not.toHaveLength(0);
    expect(await validate(invalidVersion)).not.toHaveLength(0);
  });

});
