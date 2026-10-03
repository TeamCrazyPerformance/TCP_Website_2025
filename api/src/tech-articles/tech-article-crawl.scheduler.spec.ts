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
      refreshKeywordDictionary: jest.fn().mockResolvedValue({
        status: 'SUCCESS',
        activeVersion: 'keyword-version-test',
        activatedAt: '2026-08-21T00:05:00Z',
        changed: true,
        source: 'stack-overflow',
        warnings: [],
        snapshot: {},
      }),
      overview: jest.fn().mockResolvedValue({
        qualityKeywords: { lastUpdate: null },
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

    expect(techArticles.startCrawl).toHaveBeenCalledTimes(9);
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
      'SCHEDULED',
    );
    const newSourceIds = techArticles.startCrawl.mock.calls
      .slice(5)
      .map(([crawl]) => crawl.source.sourceId);
    expect(newSourceIds).toEqual([
      'tailscale-blog',
      'rust-blog',
      'hugging-face-blog',
      'deepmind-blog',
    ]);
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
      'SCHEDULED',
    );
  });

  it('does not enqueue a completed profile twice on the same Seoul day', async () => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';
    const now = new Date('2026-08-21T06:00:00Z');

    await scheduler.runScheduledCrawls(now);
    await scheduler.runScheduledCrawls(now);

    expect(techArticles.startCrawl).toHaveBeenCalledTimes(9);
  });

  it('enqueues profiles again when the next Seoul day begins', async () => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';

    await scheduler.runScheduledCrawls(new Date('2026-08-21T14:59:59Z'));
    await scheduler.runScheduledCrawls(new Date('2026-08-21T15:00:00Z'));

    expect(techArticles.startCrawl).toHaveBeenCalledTimes(18);
    expect(techArticles.startCrawl).toHaveBeenNthCalledWith(
      10,
      expect.any(Object),
      'auto-crawl:v1:20260822T0000KST:cloudflare-blog-rss-blog',
      'SCHEDULED',
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

    expect(techArticles.startCrawl).toHaveBeenCalledTimes(10);
    const [retriedCrawl, retriedKey] = techArticles.startCrawl.mock.calls[9];
    expect(retriedCrawl.source.sourceId).toBe('github-trending');
    expect(retriedKey).toBe(
      'auto-crawl:v1:20260821T0000KST:github-trending-web-repositories-daily',
    );
  });

  it('runs the keyword refresh once per Seoul day', async () => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T00:05:00Z'),
    );
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T12:00:00Z'),
    );
    techArticles.refreshKeywordDictionary.mockResolvedValueOnce({
      status: 'SUCCESS',
      activeVersion: 'keyword-version-next',
      activatedAt: '2026-08-21T15:05:00Z',
      changed: true,
      source: 'stack-overflow',
      warnings: [],
      snapshot: {},
    });
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T15:05:00Z'),
    );

    expect(techArticles.refreshKeywordDictionary).toHaveBeenCalledTimes(2);
  });

  it('does not refresh twice when DB history already has a success for the Seoul day', async () => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';
    techArticles.overview.mockResolvedValue({
      qualityKeywords: {
        activeVersion: 'keyword-version-test',
        activatedAt: '2026-08-21T03:00:00Z',
        lastUpdate: {
          status: 'SUCCESS',
          completedAt: '2026-08-21T03:00:00Z',
        },
      },
    });

    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T04:00:00Z'),
    );

    expect(techArticles.refreshKeywordDictionary).not.toHaveBeenCalled();
  });

  it('refreshes after a Seoul-day boundary even when the previous success was one second before midnight', async () => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';
    techArticles.overview.mockResolvedValue({
      qualityKeywords: {
        activeVersion: 'keyword-version-previous',
        activatedAt: '2026-08-21T14:59:59Z',
        lastUpdate: {
          status: 'SUCCESS',
          // 2026-08-21 23:59:59 KST
          completedAt: '2026-08-21T14:59:59Z',
        },
      },
    });

    // 2026-08-22 00:05:00 KST
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T15:05:00Z'),
    );

    expect(techArticles.refreshKeywordDictionary).toHaveBeenCalledTimes(1);
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

  it('keeps a day success even when the latest attempt failed after it', async () => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';
    techArticles.overview.mockResolvedValue({
      qualityKeywords: {
        activeVersion: 'active',
        activatedAt: '2026-08-21T03:00:00Z',
        lastUpdate: { status: 'FAILED', completedAt: '2026-08-21T03:30:00Z' },
      },
    });
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T04:00:00Z'),
    );
    expect(techArticles.refreshKeywordDictionary).not.toHaveBeenCalled();
  });

  it('skips before 00:05 KST and when automatic collection is disabled', async () => {
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T05:00:00Z'),
    );
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T15:04:59Z'),
    );
    expect(techArticles.overview).not.toHaveBeenCalled();
    expect(techArticles.refreshKeywordDictionary).not.toHaveBeenCalled();
  });

  it.each([
    { status: 'AVAILABLE' },
    { status: 'FAILED' },
    { status: 'SUCCESS', activeVersion: 'active', activatedAt: '2026-08-21' },
    {
      status: 'SUCCESS',
      activeVersion: 'active',
      activatedAt: '2026-08-21T13:00:00Z',
    },
    { status: 'SUCCESS', activeVersion: 'active', activatedAt: 'bad' },
    { status: 'SUCCESS', activatedAt: '2026-08-21T03:00:00Z' },
    {
      status: 'SUCCESS',
      activeVersion: 'active',
      activatedAt: '2026-08-20T03:00:00Z',
    },
  ])('does not mark an invalid 200 result complete: %j', async (result) => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';
    techArticles.refreshKeywordDictionary.mockResolvedValue(result as never);
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T03:00:00Z'),
    );
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T03:09:59Z'),
    );
    expect(techArticles.refreshKeywordDictionary).toHaveBeenCalledTimes(1);
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T03:10:00Z'),
    );
    expect(techArticles.refreshKeywordDictionary).toHaveBeenCalledTimes(2);
  });

  it.each(['503', 'BUSY', 'timeout', 'OUTCOME_UNKNOWN'])(
    'backs off after %s without blocking article crawls',
    async (failure) => {
      settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';
      techArticles.refreshKeywordDictionary.mockRejectedValue(
        new Error(failure),
      );
      for (const time of [
        '03:00',
        '03:10',
        '03:39',
        '03:40',
        '04:39',
        '04:40',
        '05:39',
        '05:40',
      ]) {
        await scheduler.runScheduledKeywordDictionaryRefresh(
          new Date(`2026-08-21T${time}:00Z`),
        );
      }
      expect(techArticles.refreshKeywordDictionary).toHaveBeenCalledTimes(5);
      await scheduler.runScheduledCrawls(new Date('2026-08-21T05:40:00Z'));
      expect(techArticles.startCrawl).toHaveBeenCalledTimes(9);
    },
  );

  it('applies a durable failure cooldown after restart', async () => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';
    techArticles.overview.mockResolvedValue({
      qualityKeywords: {
        lastUpdate: {
          status: 'FAILED',
          completedAt: '2026-08-21T03:00:00Z',
        },
      },
    });
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T03:59:59Z'),
    );
    expect(techArticles.refreshKeywordDictionary).not.toHaveBeenCalled();
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T04:00:00Z'),
    );
    expect(techArticles.refreshKeywordDictionary).toHaveBeenCalledTimes(1);
  });

  it('deduplicates overlapping checks including the status lookup', async () => {
    settings.TECH_ARTICLE_AUTO_CRAWL_ENABLED = 'true';
    let resolve!: (value: unknown) => void;
    techArticles.overview.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const first = scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T03:00:00Z'),
    );
    await scheduler.runScheduledKeywordDictionaryRefresh(
      new Date('2026-08-21T03:00:00Z'),
    );
    resolve({});
    await first;
    expect(techArticles.overview).toHaveBeenCalledTimes(1);
    expect(techArticles.refreshKeywordDictionary).toHaveBeenCalledTimes(1);
  });

  it('launches the startup catch-up without waiting for collection', async () => {
    const check = jest
      .spyOn(scheduler, 'runScheduledKeywordDictionaryRefresh')
      .mockImplementation(() => new Promise(() => undefined));
    expect(scheduler.onApplicationBootstrap()).toBeUndefined();
    expect(check).toHaveBeenCalledTimes(1);
  });
});
