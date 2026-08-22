/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TechArticleCrawlScheduler } from './tech-article-crawl.scheduler';
import { TechArticlesService } from './tech-articles.service';

describe('TechArticleCrawlScheduler', () => {
  let settings: Record<string, string>;
  let config: jest.Mocked<ConfigService>;
  let techArticles: jest.Mocked<TechArticlesService>;
  let scheduler: TechArticleCrawlScheduler;

  beforeEach(() => {
    settings = {};
    config = {
      get: jest.fn((name: string) => settings[name]),
    } as unknown as jest.Mocked<ConfigService>;
    techArticles = {
      startCrawl: jest.fn().mockResolvedValue({
        operation: 'CREATED',
        crawlRunId: 'crawl-run-1',
      }),
    } as unknown as jest.Mocked<TechArticlesService>;
    scheduler = new TechArticleCrawlScheduler(config, techArticles);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not enqueue crawls unless explicitly enabled', async () => {
    await scheduler.runScheduledCrawls(new Date('2026-08-21T03:00:00Z'));

    expect(techArticles.startCrawl).not.toHaveBeenCalled();
  });

  it('enqueues every profile for the current Seoul calendar day', async () => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';

    await scheduler.runScheduledCrawls(new Date('2026-08-21T04:25:00Z'));

    expect(techArticles.startCrawl).toHaveBeenCalledTimes(5);
    expect(techArticles.startCrawl).toHaveBeenNthCalledWith(
      1,
      {
        source: {
          sourceId: 'cloudflare-blog',
          sourceType: 'RSS',
          sectionKey: 'BLOG',
        },
        crawlOptions: {
          maximumArticleCount: 10,
          maximumAgeHours: 48,
          followPagination: false,
          maximumPageCount: 1,
          requestTimeoutMs: 15000,
        },
      },
      'auto-crawl:v1:20260821T0000KST:cloudflare-blog-rss-blog',
    );
    const [infoQNews, infoQNewsKey] = techArticles.startCrawl.mock.calls[1];
    expect(infoQNews.source).toEqual({
      sourceId: 'infoq',
      sourceType: 'RSS',
      sectionKey: 'NEWS',
    });
    expect(infoQNewsKey).toBe('auto-crawl:v1:20260821T0000KST:infoq-rss-news');
    const [infoQEngineering, infoQEngineeringKey] =
      techArticles.startCrawl.mock.calls[2];
    expect(infoQEngineering.source).toEqual({
      sourceId: 'infoq',
      sourceType: 'RSS',
      sectionKey: 'ENGINEERING',
    });
    expect(infoQEngineeringKey).toBe(
      'auto-crawl:v1:20260821T0000KST:infoq-rss-engineering',
    );
    const [sdTimes, sdTimesKey] = techArticles.startCrawl.mock.calls[3];
    expect(sdTimes.source).toEqual({
      sourceId: 'sdtimes',
      sourceType: 'RSS',
      sectionKey: 'NEWS',
    });
    expect(sdTimesKey).toBe('auto-crawl:v1:20260821T0000KST:sdtimes-rss-news');
    expect(techArticles.startCrawl).toHaveBeenNthCalledWith(
      5,
      {
        source: {
          sourceId: 'github-trending',
          sourceType: 'WEB_CRAWL',
          sectionKey: 'REPOSITORIES',
        },
        crawlOptions: {
          maximumArticleCount: 3,
          requestTimeoutMs: 15000,
        },
      },
      'auto-crawl:v1:20260821T0000KST:github-trending-web-repositories-daily',
    );
  });

  it('does not enqueue a completed profile twice on the same Seoul day', async () => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';
    const now = new Date('2026-08-21T06:00:00Z');

    await scheduler.runScheduledCrawls(now);
    await scheduler.runScheduledCrawls(now);

    expect(techArticles.startCrawl).toHaveBeenCalledTimes(5);
  });

  it('enqueues profiles again when the next Seoul day begins', async () => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';

    await scheduler.runScheduledCrawls(new Date('2026-08-21T14:59:59Z'));
    await scheduler.runScheduledCrawls(new Date('2026-08-21T15:00:00Z'));

    expect(techArticles.startCrawl).toHaveBeenCalledTimes(10);
    expect(techArticles.startCrawl).toHaveBeenNthCalledWith(
      6,
      expect.any(Object),
      'auto-crawl:v1:20260822T0000KST:cloudflare-blog-rss-blog',
    );
  });

  it('retries only a profile that failed to enqueue', async () => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';
    let githubAttempt = 0;
    techArticles.startCrawl.mockImplementation((crawl) => {
      if (
        crawl.source.sourceId === 'github-trending' &&
        githubAttempt++ === 0
      ) {
        return Promise.reject(new Error('pipeline unavailable'));
      }
      return Promise.resolve({
        operation: 'CREATED',
        crawlRunId: 'crawl-run-2',
      });
    });
    const now = new Date('2026-08-21T12:00:00Z');

    await scheduler.runScheduledCrawls(now);
    await scheduler.runScheduledCrawls(now);

    expect(techArticles.startCrawl).toHaveBeenCalledTimes(6);
    const [retriedCrawl, retriedKey] = techArticles.startCrawl.mock.calls[5];
    expect(retriedCrawl.source.sourceId).toBe('github-trending');
    expect(retriedKey).toBe(
      'auto-crawl:v1:20260821T0000KST:github-trending-web-repositories-daily',
    );
  });

  it('uses bounded operator settings', async () => {
    settings = {
      TECH_ARTICLE_AUTO_CRAWL_ENABLED: ' TRUE ',
      TECH_ARTICLE_AUTO_CRAWL_MAX_ARTICLES: '7',
      TECH_ARTICLE_AUTO_CRAWL_MAX_AGE_HOURS: '72',
    };

    await scheduler.runScheduledCrawls(new Date('2026-08-21T15:00:00Z'));

    const [configuredCrawl] = techArticles.startCrawl.mock.calls[0];
    expect(configuredCrawl.crawlOptions).toEqual(
      expect.objectContaining({
        maximumArticleCount: 7,
        maximumAgeHours: 72,
      }),
    );
    const [githubCrawl] = techArticles.startCrawl.mock.calls[4];
    expect(githubCrawl.crawlOptions).toEqual({
      maximumArticleCount: 3,
      requestTimeoutMs: 15000,
    });
  });
});
