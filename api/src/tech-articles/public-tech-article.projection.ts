import { projectQualityEvaluation } from './quality-evaluation.projection';
import {
  PipelinePublicDetailArticle,
  PipelinePublicListArticle,
  PublicDetailSourceProjection,
  PublicListSourceProjection,
  PublicValueScore,
} from './tech-articles.types';

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function publicListSource(
  source: PublicListSourceProjection | null | undefined,
) {
  return {
    name: source?.name ?? null,
    domain: source?.domain ?? null,
  };
}

function publicDetailSource(
  source: PublicDetailSourceProjection | null | undefined,
) {
  return {
    ...publicListSource(source),
    path: source?.path ?? null,
    articleUrl: source?.articleUrl ?? null,
  };
}

function projectSuppliedValueScore(
  valueScore: PublicValueScore | null | undefined,
) {
  if (!valueScore) return null;
  const minimum = finiteNumber(valueScore.scale?.min) ?? 0;
  const maximum = finiteNumber(valueScore.scale?.max) ?? 100;
  const scale =
    maximum > minimum ? { min: minimum, max: maximum } : { min: 0, max: 100 };
  const breakdown = Array.isArray(valueScore.breakdown)
    ? valueScore.breakdown.slice(0, 20).flatMap((candidate) => {
        const label =
          typeof candidate?.label === 'string' ? candidate.label.trim() : '';
        if (!label || label.length > 100) return [];
        return [
          {
            label,
            contribution: finiteNumber(candidate.contribution),
          },
        ];
      })
    : [];
  const overall = finiteNumber(valueScore.overall);
  if (overall === null && breakdown.length === 0) return null;
  return { overall, scale, breakdown };
}

function projectLegacyValueScore(article: PipelinePublicDetailArticle) {
  const evaluation = projectQualityEvaluation(
    article.evaluation ?? { decision: article.qualityDecision },
    article.qualityScore,
  );
  const rawScore = evaluation?.score;
  if (!rawScore || typeof rawScore !== 'object' || Array.isArray(rawScore))
    return null;
  const score = rawScore as Record<string, unknown>;
  const axes = Array.isArray(score.axes) ? score.axes : [];
  const breakdown = axes.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
      return [];
    const axis = candidate as Record<string, unknown>;
    const label = typeof axis.label === 'string' ? axis.label.trim() : '';
    if (!label || label.length > 100) return [];
    return [
      {
        label,
        contribution: finiteNumber(axis.contribution),
      },
    ];
  });
  const overall = finiteNumber(score.overall);
  if (overall === null && breakdown.length === 0) return null;
  const scale =
    score.scale &&
    typeof score.scale === 'object' &&
    !Array.isArray(score.scale)
      ? (score.scale as Record<string, unknown>)
      : {};
  const minimum = finiteNumber(scale.min) ?? 0;
  const maximum = finiteNumber(scale.max) ?? 100;
  return {
    overall,
    scale:
      maximum > minimum ? { min: minimum, max: maximum } : { min: 0, max: 100 },
    breakdown,
  };
}

export function projectPublicArticleListItem(
  article: PipelinePublicListArticle,
) {
  return {
    id: article.articleId,
    title: article.localizedTitle || article.title || null,
    oneLineSummary: article.oneLineSummary ?? null,
    tags: Array.isArray(article.tags)
      ? article.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    source: publicListSource(article.source),
    originalPublishedAt: article.originalPublishedAt ?? null,
    isNew: article.isNew ?? false,
  };
}

export function projectPublicArticleDetail(
  article: PipelinePublicDetailArticle,
  isMember: boolean,
) {
  const base = {
    id: article.articleId,
    title: article.localizedTitle || article.title || null,
    oneLineSummary: article.oneLineSummary ?? null,
    summaryMarkdown: article.summaryMarkdown ?? article.summary ?? null,
    tags: Array.isArray(article.tags)
      ? article.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    source: publicDetailSource(article.source),
    originalLanguage: article.originalLanguage
      ? {
          code: article.originalLanguage.code,
          label: article.originalLanguage.label,
        }
      : null,
    originalPublishedAt: article.originalPublishedAt ?? null,
    collectedAt: article.collectedAt ?? null,
  };
  if (!isMember) return base;

  const valueScore =
    projectSuppliedValueScore(article.valueScore) ??
    projectLegacyValueScore(article);
  return { ...base, valueScore };
}
