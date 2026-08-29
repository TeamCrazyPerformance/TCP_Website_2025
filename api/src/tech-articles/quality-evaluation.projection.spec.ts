import { projectQualityEvaluation } from './quality-evaluation.projection';

describe('projectQualityEvaluation', () => {
  it('keeps server supplied axes and does not recalculate their contribution', () => {
    const result = projectQualityEvaluation({
      schemaVersion: '2.0',
      decision: 'PASS',
      score: {
        overall: 88,
        scale: { min: 0, max: 100 },
        axes: [
          {
            key: 'usefulness',
            label: '실무 활용성',
            value: 92,
            weight: 0.4,
            contribution: 36.8,
          },
        ],
      },
    });

    expect(result?.score).toEqual({
      overall: 88,
      scale: { min: 0, max: 100 },
      axes: [
        {
          key: 'usefulness',
          label: '실무 활용성',
          value: 92,
          weight: 0.4,
          contribution: 36.8,
        },
      ],
    });
  });

  it('adapts recognized legacy dimensions on the server', () => {
    const result = projectQualityEvaluation(
      {
        evaluatorVersion: '1.0.0',
        score: {
          overall: 80,
          dimensions: {
            relevance: 90,
            timeliness: 70,
            sourceReliability: 75,
          },
        },
      },
      null,
      { legacyShape: 'flat' },
    );

    expect((result?.score as Record<string, unknown>).axes).toEqual([
      expect.objectContaining({ key: 'relevance', label: '개발 관련성' }),
      expect.objectContaining({ key: 'timeliness', label: '시의성' }),
      expect.objectContaining({
        key: 'sourceReliability',
        label: '출처 신뢰도',
      }),
    ]);
    expect(result?.score).toEqual(
      expect.objectContaining({
        relevance: 90,
        timeliness: 70,
        sourceReliability: 75,
      }),
    );
  });

  it('does not invent axes for an unknown legacy shape', () => {
    const result = projectQualityEvaluation({
      score: { overall: 72, dimensions: { novelty: 72 } },
    });
    expect(result?.score).toEqual({
      overall: 72,
      scale: { min: 0, max: 100 },
      axes: [],
    });
  });

  it('restores the four-axis dimensions shape used before axes were stored', () => {
    const result = projectQualityEvaluation({
      score: {
        overall: 84,
        dimensions: {
          relevance: 90,
          technicalDepth: 80,
          timeliness: 85,
          articleQuality: 70,
        },
      },
    });

    expect((result?.score as Record<string, unknown>).axes).toEqual([
      expect.objectContaining({
        key: 'relevance',
        label: '개발 관련성',
        weight: 0.35,
      }),
      expect.objectContaining({
        key: 'technicalDepth',
        label: '기술적 깊이',
        weight: 0.3,
      }),
      expect.objectContaining({
        key: 'timeliness',
        label: '최신성',
        weight: 0.25,
      }),
      expect.objectContaining({
        key: 'articleQuality',
        label: '기사 품질',
        weight: 0.1,
      }),
    ]);
  });
});
