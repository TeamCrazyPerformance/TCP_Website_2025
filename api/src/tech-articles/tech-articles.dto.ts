import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const toArray = ({ value }: { value: unknown }): unknown[] => {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
};

export class PageQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 20;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  keyword?: string;
}

export class PublicArticleQueryDto extends PageQueryDto {
  @Transform(toArray)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @IsOptional()
  tags: string[] = [];
}

// 파이프라인 단계. 값 집합은 tech_article_pipeline.persistence.base.STAGE_NAMES
// 와 같아야 합니다. 한쪽만 늘리면 화면에서 고른 단계가 422 로 막힙니다.
export const ARTICLE_STAGES: string[] = [
  'INGESTED',
  'QUALITY_REVIEW',
  'ENRICHING',
  'PUBLICATION_REVIEW',
  'COMPLETED',
  'FAILED_AFTER_APPROVAL',
  'FAILED',
  'QUALITY_REJECTED',
];

// 통계는 목록과 같은 조건으로 세야 칩 숫자와 목록 총계가 맞습니다.
// 단계(stage)는 여기 없습니다 — 넣으면 고른 단계만 남고 나머지가 0 이 됩니다.
export class AdminArticleStatsQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  keyword?: string;

  @IsIn(['UNPUBLISHED', 'SCHEDULED', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'])
  @IsOptional()
  publicationStatus?: string;
}

export class AdminArticleQueryDto extends PageQueryDto {
  @IsIn(['UNPUBLISHED', 'SCHEDULED', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'])
  @IsOptional()
  publicationStatus?: string;

  @IsIn(ARTICLE_STAGES)
  @IsOptional()
  stage?: string;

  // 검토 상태 표시 오류. 단계 축과 별개라 stage 와 함께 쓸 수 있습니다.
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  statusMismatch?: boolean;

  @IsIn(['NEWEST', 'OLDEST', 'SCORE_DESC', 'SCORE_ASC'])
  @IsOptional()
  sort = 'NEWEST';
}

export class DuplicateReviewQueryDto extends PageQueryDto {
  @IsIn(['JACCARD'])
  @IsOptional()
  filter?: string;

  @IsIn(['NEWEST', 'SIMILARITY_DESC'])
  @IsOptional()
  sort = 'NEWEST';
}

export class ProcessingReviewQueryDto extends PageQueryDto {
  @IsIn(['RSS', 'WEB_CRAWL', 'API'])
  @IsOptional()
  filter?: string;

  @IsIn(['NEWEST'])
  @IsOptional()
  sort = 'NEWEST';
}

export class PublicationActionDto {
  @IsIn(['PUBLISH', 'HIDE', 'ARCHIVE'])
  action: 'PUBLISH' | 'HIDE' | 'ARCHIVE';

  @IsInt()
  @Min(1)
  expectedRecordVersion: number;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason = '';
}

export class BulkPublicationItemDto extends PublicationActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  articleId: string;
}

export class BulkPublicationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique(
    (item: BulkPublicationItemDto | null | undefined) => item?.articleId,
  )
  @ValidateNested({ each: true })
  @Type(() => BulkPublicationItemDto)
  items: BulkPublicationItemDto[];
}

export class DuplicateResolutionDto {
  @IsInt()
  @Min(1)
  expectedCaseVersion: number;

  @IsIn(['APPROVE_UNIQUE', 'CONFIRM_DUPLICATE'])
  action: 'APPROVE_UNIQUE' | 'CONFIRM_DUPLICATE';

  @ValidateIf(
    (item: DuplicateResolutionDto) => item.action === 'CONFIRM_DUPLICATE',
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  matchedArticleId?: string;
}

export class BulkDuplicateResolutionItemDto extends DuplicateResolutionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  caseId: string;
}

export class BulkDuplicateResolutionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique(
    (item: BulkDuplicateResolutionItemDto | null | undefined) => item?.caseId,
  )
  @ValidateNested({ each: true })
  @Type(() => BulkDuplicateResolutionItemDto)
  items: BulkDuplicateResolutionItemDto[];
}

export class QualityResolutionDto {
  @IsInt()
  @Min(1)
  expectedCaseVersion: number;

  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';
}

export class BulkQualityResolutionItemDto extends QualityResolutionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  caseId: string;
}

export class BulkQualityResolutionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique(
    (item: BulkQualityResolutionItemDto | null | undefined) => item?.caseId,
  )
  @ValidateNested({ each: true })
  @Type(() => BulkQualityResolutionItemDto)
  items: BulkQualityResolutionItemDto[];
}

export class PublicationPolicyDto {
  @IsIn(['IMMEDIATE', 'REVIEW'])
  policy: 'IMMEDIATE' | 'REVIEW';

  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class CrawlSourceDto {
  @IsIn(['cloudflare-blog', 'infoq', 'sdtimes', 'github-trending'])
  sourceId: 'cloudflare-blog' | 'infoq' | 'sdtimes' | 'github-trending';

  @IsIn(['RSS', 'WEB_CRAWL', 'API'])
  sourceType: 'RSS' | 'WEB_CRAWL' | 'API';

  @IsIn(['BLOG', 'NEWS', 'ENGINEERING', 'REPOSITORIES'])
  sectionKey: 'BLOG' | 'NEWS' | 'ENGINEERING' | 'REPOSITORIES';
}

export class CrawlOptionsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maximumArticleCount?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maximumAgeHours?: number;

  @IsBoolean()
  @IsOptional()
  followPagination?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  maximumPageCount?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(60000)
  @IsOptional()
  requestTimeoutMs?: number;
}

export class CrawlRunDto {
  @ValidateNested()
  @Type(() => CrawlSourceDto)
  source: CrawlSourceDto;

  @ValidateNested()
  @Type(() => CrawlOptionsDto)
  @IsOptional()
  crawlOptions?: CrawlOptionsDto;
}

export class ArticleIdParamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  articleId: string;
}

export class ReviewCaseIdParamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  caseId: string;
}

export class CrawlRunIdParamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  crawlRunId: string;
}
