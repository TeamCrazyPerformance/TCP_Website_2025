export interface QualityScoreAxis {
  key: string;
  label: string;
  value: number;
  weight: number | null;
  contribution: number | null;
}

export interface QualityEvaluation {
  schemaVersion?: string;
  status?: string | null;
  decision?: string | null;
  evaluatedAt?: string | null;
  evaluatorVersion?: string | null;
  policyVersion?: string | null;
  reason?: string | null;
  rejectionCodes?: string[];
  signals?: Record<string, unknown> | null;
  score?: Record<string, unknown> | null;
  error?: unknown;
}

// 구형 관리자·내부 클라이언트 호환용입니다.
type LegacyShape = 'dimensions' | 'flat' | false;

interface ProjectionOptions {
  includeOperational?: boolean;
  legacyShape?: LegacyShape;
}

interface LegacyAxisDefinition {
  readonly key: string;
  readonly label: string;
  readonly weight: number;
}

// axes가 없는 과거 평가 결과의 표시용 매핑입니다.
const LEGACY_V1_AXES: readonly LegacyAxisDefinition[] = [
  { key: 'relevance', label: '개발 관련성', weight: 0.45 },
  { key: 'timeliness', label: '시의성', weight: 0.3 },
  { key: 'sourceReliability', label: '출처 신뢰도', weight: 0.25 },
] as const;

const LEGACY_V2_AXES: readonly LegacyAxisDefinition[] = [
  { key: 'relevance', label: '개발 관련성', weight: 0.35 },
  { key: 'technicalDepth', label: '기술적 깊이', weight: 0.3 },
  { key: 'timeliness', label: '최신성', weight: 0.25 },
  { key: 'articleQuality', label: '기사 품질', weight: 0.1 },
] as const;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function scaleOf(score: Record<string, unknown>) {
  const scale = asRecord(score.scale);
  const minimum = finiteNumber(scale?.min) ?? 0;
  const maximum = finiteNumber(scale?.max) ?? 100;
  return maximum > minimum
    ? { min: minimum, max: maximum }
    : { min: 0, max: 100 };
}

function suppliedAxes(score: Record<string, unknown>): QualityScoreAxis[] {
  if (!Array.isArray(score.axes)) return [];
  const seen = new Set<string>();
  const result: QualityScoreAxis[] = [];
  for (const candidate of score.axes.slice(0, 20)) {
    const axis = asRecord(candidate);
    const key = typeof axis?.key === 'string' ? axis.key.trim() : '';
    const label = typeof axis?.label === 'string' ? axis.label.trim() : '';
    const value = finiteNumber(axis?.value);
    if (
      !key ||
      key.length > 64 ||
      !label ||
      label.length > 100 ||
      value === null
    )
      continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const rawWeight = finiteNumber(axis?.weight);
    const weight =
      rawWeight !== null && rawWeight >= 0 && rawWeight <= 1 ? rawWeight : null;
    result.push({
      key,
      label,
      value,
      weight,
      contribution: finiteNumber(axis?.contribution),
    });
  }
  return result;
}

function legacyAxes(score: Record<string, unknown>): QualityScoreAxis[] {
  const dimensions = asRecord(score.dimensions);
  if (!dimensions) return [];
  const definitions =
    finiteNumber(dimensions.technicalDepth) !== null ||
    finiteNumber(dimensions.articleQuality) !== null
      ? LEGACY_V2_AXES
      : LEGACY_V1_AXES;
  const result: QualityScoreAxis[] = [];
  for (const definition of definitions) {
    const value = finiteNumber(dimensions[definition.key]);
    if (value === null) continue;
    result.push({
      ...definition,
      value,
      contribution: Number((value * definition.weight).toFixed(2)),
    });
  }
  return result;
}

export function projectQualityEvaluation(
  input: QualityEvaluation | null | undefined,
  fallbackOverall?: number | null,
  options: ProjectionOptions = {},
) {
  const evaluation = asRecord(input);
  if (!evaluation && finiteNumber(fallbackOverall) === null) return null;

  const score = asRecord(evaluation?.score) ?? {};
  const supplied = suppliedAxes(score);
  const axes = supplied.length ? supplied : legacyAxes(score);
  const overall = finiteNumber(score.overall) ?? finiteNumber(fallbackOverall);
  const legacyDimensions = asRecord(score.dimensions);
  const projectedScore: Record<string, unknown> | null =
    overall === null && axes.length === 0
      ? null
      : {
          overall,
          scale: scaleOf(score),
          axes,
        };

  if (
    projectedScore &&
    options.legacyShape === 'dimensions' &&
    legacyDimensions
  ) {
    projectedScore.dimensions = legacyDimensions;
  }
  if (projectedScore && options.legacyShape === 'flat' && legacyDimensions) {
    for (const definition of LEGACY_V1_AXES) {
      projectedScore[definition.key] =
        finiteNumber(legacyDimensions[definition.key]) ?? null;
    }
  }

  const projected: Record<string, unknown> = {
    schemaVersion:
      typeof evaluation?.schemaVersion === 'string'
        ? evaluation.schemaVersion
        : supplied.length
          ? '2.0'
          : '1.0',
    evaluatorVersion: evaluation?.evaluatorVersion ?? null,
    policyVersion: evaluation?.policyVersion ?? null,
    decision: evaluation?.decision ?? null,
    reason: evaluation?.reason ?? null,
    signals: asRecord(evaluation?.signals),
    score: projectedScore,
  };

  if (options.includeOperational) {
    projected.status = evaluation?.status ?? null;
    projected.evaluatedAt = evaluation?.evaluatedAt ?? null;
    projected.rejectionCodes = Array.isArray(evaluation?.rejectionCodes)
      ? evaluation.rejectionCodes.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    projected.error = evaluation?.error ?? null;
  }
  return projected;
}
