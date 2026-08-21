import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BulkPublicationDto,
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
});
