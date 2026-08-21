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

export class AdminArticleQueryDto extends PageQueryDto {
  @IsIn(['UNPUBLISHED', 'SCHEDULED', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'])
  @IsOptional()
  publicationStatus?: string;

  @IsIn(['NEWEST', 'SCORE_DESC', 'SCORE_ASC'])
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
