import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { CrawlRunDto } from './tech-articles.dto';
import { TechArticlesService } from './tech-articles.service';

const SEOUL_UTC_OFFSET_MS = 9 * 60 * 60 * 1000;
const DEFAULT_MAXIMUM_ARTICLE_COUNT = 10;
const DEFAULT_MAXIMUM_AGE_HOURS = 48;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const KEYWORD_DICTIONARY_REFRESH_PROFILE_ID = 'quality-keyword-dictionary';

interface ScheduledCrawlProfile {
  id: string;
  source: CrawlRunDto['source'];
}

interface CrawlRunAccepted {
  crawlRunId?: string;
  operation?: string;
}

interface KeywordDictionaryOverview {
  qualityKeywords?: {
    activeVersion?: string | null;
    activatedAt?: string | null;
    lastUpdate?: {
      status?: string;
      completedAt?: string | null;
    };
  };
}

const SCHEDULED_CRAWL_PROFILES: readonly ScheduledCrawlProfile[] = [
  {
    id: 'cloudflare-blog-rss-blog',
    source: {
      sourceId: 'cloudflare-blog',
      sourceType: 'RSS',
      sectionKey: 'BLOG',
    },
  },
  {
    id: 'infoq-rss-news',
    source: {
      sourceId: 'infoq',
      sourceType: 'RSS',
      sectionKey: 'NEWS',
    },
  },
  {
    id: 'infoq-rss-engineering',
    source: {
      sourceId: 'infoq',
      sourceType: 'RSS',
      sectionKey: 'ENGINEERING',
    },
  },
  {
    id: 'sdtimes-rss-news',
    source: {
      sourceId: 'sdtimes',
      sourceType: 'RSS',
      sectionKey: 'NEWS',
    },
  },
  {
    id: 'github-trending-web-repositories-daily',
    source: {
      sourceId: 'github-trending',
      sourceType: 'WEB_CRAWL',
      sectionKey: 'REPOSITORIES',
    },
  },
  {
    id: 'tailscale-blog-rss-blog',
    source: {
      sourceId: 'tailscale-blog',
      sourceType: 'RSS',
      sectionKey: 'BLOG',
    },
  },
  {
    id: 'rust-blog-rss-blog',
    source: {
      sourceId: 'rust-blog',
      sourceType: 'RSS',
      sectionKey: 'BLOG',
    },
  },
  {
    id: 'hugging-face-blog-rss-blog',
    source: {
      sourceId: 'hugging-face-blog',
      sourceType: 'RSS',
      sectionKey: 'BLOG',
    },
  },
  {
    id: 'deepmind-blog-rss-blog',
    source: {
      sourceId: 'deepmind-blog',
      sourceType: 'RSS',
      sectionKey: 'BLOG',
    },
  },
];

@Injectable()
export class TechArticleCrawlScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(TechArticleCrawlScheduler.name);
  private readonly completedDayByProfile = new Map<string, string>();
  private readonly inFlightKeys = new Set<string>();
  private keywordRetry?: {
    dayKey: string;
    failures: number;
    nextAttemptAt: number;
  };

  constructor(
    private readonly config: ConfigService,
    private readonly techArticles: TechArticlesService,
  ) {}

  onApplicationBootstrap(): void {
    void this.runScheduledKeywordDictionaryRefresh().catch(() => {
      this.logger.error('Startup keyword dictionary check failed');
    });
  }

  @Cron('0 */10 * * * *', {
    name: 'tech-article-auto-crawl',
    timeZone: 'Asia/Seoul',
  })
  async runScheduledCrawls(now: Date = new Date()): Promise<void> {
    if (!this.enabled()) return;

    const dayKey = this.dayKey(now);
    const crawlOptions = {
      maximumArticleCount: this.integerSetting(
        'TECH_ARTICLE_AUTO_CRAWL_MAX_ARTICLES',
        DEFAULT_MAXIMUM_ARTICLE_COUNT,
        100,
      ),
      maximumAgeHours: this.integerSetting(
        'TECH_ARTICLE_AUTO_CRAWL_MAX_AGE_HOURS',
        DEFAULT_MAXIMUM_AGE_HOURS,
      ),
      followPagination: false,
      maximumPageCount: 1,
      requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    };

    for (const profile of SCHEDULED_CRAWL_PROFILES) {
      if (this.completedDayByProfile.get(profile.id) === dayKey) {
        continue;
      }

      const idempotencyKey = `auto-crawl:v1:${dayKey}:${profile.id}`;
      if (this.inFlightKeys.has(idempotencyKey)) continue;

      this.inFlightKeys.add(idempotencyKey);
      try {
        const profileCrawlOptions =
          profile.source.sourceId === 'github-trending'
            ? {
                maximumArticleCount: 3,
                requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
              }
            : crawlOptions;
        const accepted = (await this.techArticles.startCrawl(
          {
            source: profile.source,
            crawlOptions: profileCrawlOptions,
          },
          idempotencyKey,
          'SCHEDULED',
        )) as CrawlRunAccepted;
        this.completedDayByProfile.set(profile.id, dayKey);
        this.logger.log(
          `Scheduled crawl ${accepted.operation ?? 'ACCEPTED'}: ${profile.id} ` +
            `day=${dayKey} crawlRunId=${accepted.crawlRunId ?? 'unknown'}`,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        this.logger.error(
          `Scheduled crawl enqueue failed: ${profile.id} day=${dayKey} ${message}`,
        );
      } finally {
        this.inFlightKeys.delete(idempotencyKey);
      }
    }
  }

  @Cron('0 5,15,25,35,45,55 * * * *', {
    name: 'tech-article-keyword-dictionary-refresh',
    timeZone: 'Asia/Seoul',
  })
  async runScheduledKeywordDictionaryRefresh(
    now: Date = new Date(),
  ): Promise<void> {
    if (!this.enabled()) return;
    const seoul = new Date(now.getTime() + SEOUL_UTC_OFFSET_MS);
    if (
      !Number.isFinite(now.getTime()) ||
      (seoul.getUTCHours() === 0 && seoul.getUTCMinutes() < 5)
    )
      return;
    await this.refreshKeywordDictionary(this.dayKey(now), now);
  }

  private async refreshKeywordDictionary(
    dayKey: string,
    now: Date,
  ): Promise<void> {
    if (
      this.completedDayByProfile.get(KEYWORD_DICTIONARY_REFRESH_PROFILE_ID) ===
      dayKey
    ) {
      return;
    }

    const inFlightKey = `quality-keyword-refresh:v1:${dayKey}`;
    if (this.inFlightKeys.has(inFlightKey)) return;

    this.inFlightKeys.add(inFlightKey);
    const startedAt = Date.now();
    try {
      let overview: KeywordDictionaryOverview | undefined;
      try {
        overview =
          (await this.techArticles.overview()) as KeywordDictionaryOverview;
      } catch {
        this.logger.warn(
          `Keyword dictionary status lookup failed: day=${dayKey}`,
        );
      }
      const keywords = overview?.qualityKeywords;
      if (
        this.confirmedDayVersion(
          keywords?.activeVersion,
          keywords?.activatedAt,
          dayKey,
          now,
        )
      ) {
        this.completedDayByProfile.set(
          KEYWORD_DICTIONARY_REFRESH_PROFILE_ID,
          dayKey,
        );
        this.keywordRetry = undefined;
        return;
      }
      if (this.keywordRetry?.dayKey !== dayKey) this.keywordRetry = undefined;
      if (this.keywordRetry && now.getTime() < this.keywordRetry.nextAttemptAt)
        return;
      const lastUpdate = keywords?.lastUpdate;
      const failedAt = lastUpdate?.completedAt
        ? Date.parse(lastUpdate.completedAt)
        : NaN;
      if (
        !this.keywordRetry &&
        lastUpdate?.status === 'FAILED' &&
        Number.isFinite(failedAt) &&
        failedAt <= now.getTime() &&
        now.getTime() < failedAt + 60 * 60_000
      )
        return;
      const result = (await this.techArticles.refreshKeywordDictionary()) as {
        status?: string;
        activeVersion?: string;
        activatedAt?: string;
      };
      if (
        result?.status !== 'SUCCESS' ||
        !this.confirmedDayVersion(
          result.activeVersion,
          result.activatedAt,
          dayKey,
          new Date(now.getTime() + Math.max(0, Date.now() - startedAt)),
        )
      )
        throw new Error('Invalid keyword refresh success response');
      this.completedDayByProfile.set(
        KEYWORD_DICTIONARY_REFRESH_PROFILE_ID,
        dayKey,
      );
      this.keywordRetry = undefined;
      this.logger.log(
        `Scheduled keyword dictionary refresh completed: day=${dayKey}`,
      );
    } catch (error) {
      const failures =
        (this.keywordRetry?.dayKey === dayKey
          ? this.keywordRetry.failures
          : 0) + 1;
      this.keywordRetry = {
        dayKey,
        failures,
        nextAttemptAt:
          now.getTime() + [10, 30, 60][Math.min(failures - 1, 2)] * 60_000,
      };
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `Scheduled keyword dictionary refresh failed: day=${dayKey} ${message}`,
      );
    } finally {
      this.inFlightKeys.delete(inFlightKey);
    }
  }

  private confirmedDayVersion(
    version: unknown,
    activatedAt: unknown,
    dayKey: string,
    now?: Date,
  ): boolean {
    if (
      typeof version !== 'string' ||
      !version.trim() ||
      typeof activatedAt !== 'string'
    )
      return false;
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(
        activatedAt,
      )
    )
      return false;
    const activated = new Date(activatedAt);
    return (
      Number.isFinite(activated.getTime()) &&
      (!now || activated.getTime() <= now.getTime()) &&
      this.dayKey(activated) === dayKey
    );
  }

  private enabled(): boolean {
    return (
      this.config
        .get<string>('TECH_ARTICLE_AUTO_CRAWL_ENABLED')
        ?.trim()
        .toLowerCase() === 'true'
    );
  }

  private integerSetting(
    name: string,
    fallback: number,
    maximum?: number,
  ): number {
    const parsed = Number(this.config.get<string>(name));
    if (!Number.isInteger(parsed) || parsed < 1) return fallback;
    if (maximum !== undefined && parsed > maximum) return fallback;
    return parsed;
  }

  private dayKey(now: Date): string {
    const seoul = new Date(now.getTime() + SEOUL_UTC_OFFSET_MS);
    const year = seoul.getUTCFullYear();
    const month = String(seoul.getUTCMonth() + 1).padStart(2, '0');
    const day = String(seoul.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}T0000KST`;
  }
}
