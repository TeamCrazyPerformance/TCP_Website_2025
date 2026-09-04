import { QualityEvaluation } from './quality-evaluation.projection';

export interface SourceProjection {
  id?: string;
  name?: string;
  type?: string;
  domain?: string | null;
  path?: string;
  articleUrl?: string | null;
}

export interface LanguageProjection {
  code: string;
  label: string;
}

export interface PublicValueScore {
  overall: number | null;
  scale: {
    min: number;
    max: number;
  };
  breakdown: Array<{
    label: string;
    contribution: number | null;
  }>;
}

export interface PublicListSourceProjection {
  name?: string;
  domain?: string | null;
}

export interface PublicDetailSourceProjection
  extends PublicListSourceProjection {
  path?: string;
  articleUrl?: string | null;
}

interface PipelinePublicArticleBase<
  TSource extends PublicListSourceProjection,
> {
  articleId: string;
  title?: string | null;
  localizedTitle?: string | null;
  oneLineSummary?: string | null;
  tags?: string[];
  source?: TSource | null;
  originalPublishedAt?: string | null;
}

export interface PipelinePublicListArticle
  extends PipelinePublicArticleBase<PublicListSourceProjection> {
  isNew?: boolean;
}

export interface PipelinePublicDetailArticle
  extends PipelinePublicArticleBase<PublicDetailSourceProjection> {
  summaryMarkdown?: string | null;
  summary?: string | null;
  originalLanguage?: LanguageProjection | null;
  collectedAt?: string | null;
  valueScore?: PublicValueScore | null;

  // 이전 파이프라인 응답을 축소하기 위한 입력 호환 필드입니다.
  qualityScore?: number | null;
  qualityDecision?: string | null;
  evaluation?: QualityEvaluation | null;
}

export interface PipelineArticle {
  articleId: string;
  recordVersion?: number;
  title?: string | null;
  localizedTitle?: string | null;
  authors?: string[];
  oneLineSummary?: string | null;
  summaryMarkdown?: string | null;
  summary?: string | null;
  tags?: string[];
  source?: SourceProjection | null;
  canonicalUrl?: string | null;
  articleUrl?: string | null;
  originalLanguage?: LanguageProjection | null;
  originalPublishedAt?: string | null;
  collectedAt?: string | null;
  isNew?: boolean;
  viewCounts?: {
    member?: number;
    guest?: number;
    lastViewedAt?: string | null;
  };
  normalizedAt?: string | null;
  qualityScore?: number | null;
  valueScore?: number | null;
  qualityDecision?: string | null;
  evaluation?: QualityEvaluation | null;
  processingStatus?: string;
  stage?: string;
  duplicateStatus?: string;
  qualityReview?: {
    caseId: string;
    caseVersion: number;
  } | null;
  reviewStatus?: string;
  publicationStatus?: string;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
