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

// 배포 전환 기간에만 쓰는 옛 점수 형태입니다.
//   'flat'       — 공개 상세. 옛 프런트 번들이 evaluation.score.relevance 를 직접 읽습니다.
//   'dimensions' — 관리자·검수. 옛 화면이 evaluation.score.dimensions 를 읽습니다.
//
// 제거 조건 — 새 번들이 모든 클라이언트에 배포되고, 파이프라인이 axes 를 담은
// 평가 결과만 반환하게 되면(= modules/quality 에서 score.dimensions 를 걷어내면)
// 이 옵션과 legacyAxes() 를 함께 지웁니다. 셋은 같은 전환기를 위한 코드라
// 하나만 남기면 의미가 없습니다.
type LegacyShape = 'dimensions' | 'flat' | false;

interface ProjectionOptions {
  includeOperational?: boolean;
  legacyShape?: LegacyShape;
}

// axes 메타데이터가 저장되기 전의 evaluator v1 결과만 복구하기 위한 호환표입니다.
// 신규 평가 결과의 라벨과 가중치는 반드시 파이프라인이 보낸 axes 를 사용합니다.
const LEGACY_V1_AXES = [
  { key: 'relevance', label: '개발 관련성', weight: 0.45 },
  { key: 'timeliness', label: '시의성', weight: 0.3 },
  { key: 'sourceReliability', label: '출처 신뢰도', weight: 0.25 },
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
  return LEGACY_V1_AXES.flatMap((definition) => {
    const value = finiteNumber(dimensions[definition.key]);
    if (value === null) return [];
    return [
      {
        ...definition,
        value,
        contribution: Number((value * definition.weight).toFixed(2)),
      },
    ];
  });
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
