import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { CrawlRunDto } from './tech-articles.dto';
import { TechArticlesService } from './tech-articles.service';

const SEOUL_UTC_OFFSET_MS = 9 * 60 * 60 * 1000;
const DEFAULT_MAXIMUM_ARTICLE_COUNT = 10;
const DEFAULT_MAXIMUM_AGE_HOURS = 48;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

interface ScheduledCrawlProfile {
  id: string;
  source: CrawlRunDto['source'];
}

interface CrawlRunAccepted {
  crawlRunId?: string;
  operation?: string;
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
];

@Injectable()
export class TechArticleCrawlScheduler {
  private readonly logger = new Logger(TechArticleCrawlScheduler.name);
  private readonly completedDayByProfile = new Map<string, string>();
  private readonly inFlightKeys = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly techArticles: TechArticlesService,
  ) {}

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
