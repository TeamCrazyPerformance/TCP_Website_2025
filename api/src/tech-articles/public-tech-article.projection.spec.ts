import {
  projectPublicArticleDetail,
  projectPublicArticleListItem,
} from './public-tech-article.projection';

const internalArticle = {
  articleId: 'article-1',
  title: 'Original title',
  localizedTitle: '공개 제목',
  oneLineSummary: '한 줄 요약',
  summaryMarkdown: '## 상세 요약',
  tags: ['AI'],
  source: {
    id: 'internal-source-id',
    name: 'InfoQ',
    type: 'RSS',
    domain: 'infoq.com',
    path: '/articles/example',
    articleUrl: 'https://www.infoq.com/articles/example',
  },
  originalLanguage: { code: 'en', label: '영어' },
  originalPublishedAt: '2026-08-15T00:00:00Z',
  collectedAt: '2026-08-15T01:00:00Z',
  isNew: true,
  authors: ['Internal Author'],
  content: 'must-not-leak',
  localizedContent: 'must-not-leak-either',
  recordVersion: 7,
  processingStatus: 'ENRICHED',
  evaluation: {
    schemaVersion: '2.0',
    evaluatorVersion: '1.1.0',
    policyVersion: 'quality-policy-v1',
    decision: 'PASS',
    reason: 'internal reason',
    signals: { spam: false },
    score: {
      overall: 88,
      scale: { min: 0, max: 100 },
      axes: [
        {
          key: 'relevance',
          label: '개발 관련성',
          value: 91,
          weight: 0.35,
          contribution: 31.85,
        },
      ],
    },
  },
};

describe('public tech article projections', () => {
  it('keeps the public list item on an exact allowlist', () => {
    const result = projectPublicArticleListItem(internalArticle);

    expect(Object.keys(result)).toEqual([
      'id',
      'title',
      'oneLineSummary',
      'tags',
      'source',
      'originalPublishedAt',
      'isNew',
    ]);
    expect(Object.keys(result.source)).toEqual(['name', 'domain']);
    expect(JSON.stringify(result)).not.toMatch(
      /must-not-leak|internal-source-id|processingStatus|recordVersion|RSS/,
    );
  });

  it('keeps the guest detail on an exact allowlist', () => {
    const result = projectPublicArticleDetail(internalArticle, false);

    expect(Object.keys(result)).toEqual([
      'id',
      'title',
      'oneLineSummary',
      'summaryMarkdown',
      'tags',
      'source',
      'originalLanguage',
      'originalPublishedAt',
      'collectedAt',
    ]);
    expect(Object.keys(result.source)).toEqual([
      'name',
      'domain',
      'path',
      'articleUrl',
    ]);
    expect(result).not.toHaveProperty('authors');
    expect(result).not.toHaveProperty('isNew');
    expect(result).not.toHaveProperty('evaluation');
    expect(result).not.toHaveProperty('valueScore');
  });

  it('adds only display-safe value score fields for a member', () => {
    const result = projectPublicArticleDetail(internalArticle, true);
    const valueScore = 'valueScore' in result ? result.valueScore : null;

    expect(valueScore).toEqual({
      overall: 88,
      scale: { min: 0, max: 100 },
      breakdown: [{ label: '개발 관련성', contribution: 31.85 }],
    });
    expect(Object.keys(valueScore ?? {})).toEqual([
      'overall',
      'scale',
      'breakdown',
    ]);
    expect(Object.keys(valueScore?.breakdown[0] ?? {})).toEqual([
      'label',
      'contribution',
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /schemaVersion|evaluatorVersion|policyVersion|decision|reason|signals|weight|relevance/,
    );
  });

  it('accepts the new minimal pipeline value score without widening it', () => {
    const untrustedInternalResponse = {
      ...internalArticle,
      evaluation: undefined,
      valueScore: {
        overall: 91,
        scale: { min: 0, max: 100 },
        breakdown: [
          {
            label: '기술적 깊이',
            contribution: 27.3,
            key: 'technicalDepth',
            value: 91,
            weight: 0.3,
          },
        ],
      },
    } as unknown as Parameters<typeof projectPublicArticleDetail>[0];
    const result = projectPublicArticleDetail(untrustedInternalResponse, true);
    const valueScore = 'valueScore' in result ? result.valueScore : null;

    expect(valueScore).toEqual({
      overall: 91,
      scale: { min: 0, max: 100 },
      breakdown: [{ label: '기술적 깊이', contribution: 27.3 }],
    });
  });

  it('uses key presence to distinguish a member with no score from a guest', () => {
    const result = projectPublicArticleDetail(
      {
        articleId: 'article-without-score',
        title: '공개 제목',
      },
      true,
    );

    expect(result).toHaveProperty('valueScore', null);
    expect(result).not.toHaveProperty('evaluation');
  });
});
