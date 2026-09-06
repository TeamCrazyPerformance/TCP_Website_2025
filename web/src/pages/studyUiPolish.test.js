const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

const TAILWIND_V3_OPACITY = /(?:bg|text|border|from|via|to)-[a-z]+(?:-\d+)?\/\d+/;

const STUDY_SOURCES = [
  'pages/Study.jsx',
  'pages/StudyDetail.jsx',
  'pages/StudyManagement.jsx',
  'pages/StudyProgressWrite.jsx',
  'pages/admin/AdminStudy.jsx',
  'pages/mypage/MyStudies.jsx',
  'components/modals/RecruitStudyModal.jsx',
];

describe('스터디 화면 UI 정리', () => {
  it.each(STUDY_SOURCES)('%s 는 Tailwind 3 전용 불투명도 문법을 쓰지 않는다', (file) => {
    expect(read(file)).not.toMatch(TAILWIND_V3_OPACITY);
  });

  it('주차 카드의 편집·삭제는 호버로 감추지 않고 하단에 항상 둔다', () => {
    const source = read('pages/StudyDetail.jsx');
    const studyCss = read('styles/studyDetail.css');
    const indexCss = read('index.css');

    expect(source).not.toContain('hover-content');
    expect(indexCss).not.toContain('.hover-content');
    expect(studyCss).not.toContain('hover-content');

    expect(source).toContain('study-detail-week-footer');
    expect(studyCss).toMatch(
      /\.study-detail-week-footer\s*\{[^}]*margin-top:\s*auto;[^}]*justify-content:\s*space-between;/s,
    );
    expect(studyCss).toMatch(
      /\.study-detail-week-card\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
    );
  });

  it('편집·삭제 버튼은 권한이 있는 사용자에게만 렌더된다', () => {
    const source = read('pages/StudyDetail.jsx');
    const footer = source.match(
      /<div className="study-detail-week-footer">([\s\S]*?)\n {20}<\/div>/,
    );
    expect(footer).not.toBeNull();

    const guardIndex = footer[1].indexOf('{canManage && (');
    expect(guardIndex).toBeGreaterThan(-1);

    const beforeGuard = footer[1].slice(0, guardIndex);
    const insideGuard = footer[1].slice(guardIndex);

    expect(beforeGuard).not.toContain('편집');
    expect(beforeGuard).not.toContain('삭제');
    expect(insideGuard).toContain('편집');
    expect(insideGuard).toContain('삭제');
    expect(insideGuard).toContain('study-detail-week-actions');

    expect(insideGuard).toContain('onClick={(e) => e.stopPropagation()}');
    expect(insideGuard).toContain('e.stopPropagation();');
  });

  it('주차 카드 제목과 미리보기는 자체 정의한 줄 수 제한을 쓴다', () => {
    const source = read('pages/StudyDetail.jsx');
    const css = read('styles/studyDetail.css');

    expect(source).not.toMatch(/line-clamp-\d/);
    expect(source).toContain('study-detail-week-title');
    expect(source).toContain('study-detail-week-excerpt');
    expect(css).toMatch(
      /\.study-detail-week-title\s*\{[^}]*-webkit-line-clamp:\s*2;/s,
    );
    expect(css).toMatch(
      /\.study-detail-week-excerpt\s*\{[^}]*-webkit-line-clamp:\s*3;/s,
    );
  });

  it('진행사항 본문은 긴 URL 을 강제로 줄바꿈해 모달을 넘지 않는다', () => {
    const css = read('index.css');

    expect(css).toMatch(/\.article-body\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
    expect(css).toMatch(/\.article-body a\s*\{[^}]*word-break:\s*break-all;/s);
  });

  it('한 줄 소개는 값이 있을 때만 보여주고 문구를 지어내지 않는다', () => {
    const source = read('pages/StudyDetail.jsx');

    // eslint-disable-next-line no-template-curly-in-string
    expect(source).not.toContain('안녕하세요, ${member.name}입니다.');
    expect(source).toMatch(/\{member\.bio && \(/);
  });

  it('스터디 개설 모달은 고정 헤더·푸터 시트 구조를 쓴다', () => {
    const source = read('components/modals/RecruitStudyModal.jsx');
    const css = read('styles/studyRecruitModal.css');

    expect(source).toContain('study-recruit-sheet');
    expect(source).toContain('study-recruit-scroll');
    expect(source).toContain('study-recruit-footer');
    expect(source).toMatch(/role="dialog"/);
    expect(source).toMatch(/aria-modal="true"/);
    expect(css).toMatch(
      /\.study-recruit-scroll\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s,
    );
    expect(css).toMatch(
      /\.study-recruit-submit\s*\{[^}]*color:\s*var\(--cta-text-color\);/s,
    );
  });

  it('스터디 개설 모달은 배경 클릭을 정확히 구분하고 배경 스크롤을 잠근다', () => {
    const source = read('components/modals/RecruitStudyModal.jsx');

    expect(source).not.toContain("e.target.className.includes('modal')");
    expect(source).toContain('e.target === e.currentTarget');
    expect(source).toContain("document.body.style.overflow = 'hidden'");
    expect(source).toContain('document.body.style.overflow = previousOverflow');
  });

  it('개설 모달의 필수 표시는 지원서와 같은 색을 쓴다', () => {
    const studyCss = read('styles/studyRecruitModal.css');
    const recruitmentCss = read('styles/recruitmentApplication.css');

    const pick = (css, selector) => {
      const match = css.match(
        new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`, 's'),
      );
      return {
        color: match[1].match(/color:\s*([^;]+);/)[1].trim(),
        weight: match[1].match(/font-weight:\s*([^;]+);/)[1].trim(),
      };
    };

    expect(pick(studyCss, '.study-recruit-required')).toEqual(
      pick(recruitmentCss, '.recruitment-question-required'),
    );
  });

  it('스터디원 카드는 역할 태그와 내보내기를 같은 줄 하단에 둔다', () => {
    const source = read('pages/StudyDetail.jsx');
    const css = read('styles/studyDetail.css');

    const footer = source.match(
      /<div className="study-detail-member-footer">([\s\S]*?)<\/div>\s*\)\}/,
    );
    expect(footer).not.toBeNull();
    expect(footer[1]).toContain("{member.role || 'MEMBER'}");
    expect(footer[1]).toContain('내보내기');

    expect(css).toMatch(
      /\.study-detail-member-footer\s*\{[^}]*margin-top:\s*auto;[^}]*justify-content:\s*space-between;/s,
    );
    expect(css).toMatch(
      /\.study-detail-member-card\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
    );
  });

  it('주차 카드 제목과 내용은 좌측 정렬한다', () => {
    const css = read('styles/studyDetail.css');
    const appCss = read('App.css');

    expect(appCss).toMatch(/\.App\s*\{[^}]*text-align:\s*center;/s);
    expect(css).toMatch(
      /\.study-detail-week-card\s*\{[^}]*text-align:\s*left;/s,
    );
  });

  it('버튼 위아래 여백은 카드 여백과 분리된 손잡이로 조절한다', () => {
    const css = read('styles/studyDetail.css');
    const card = css.match(/\.study-detail-week-card\s*\{([^}]*)\}/s)[1];
    const footer = css.match(/\.study-detail-week-footer\s*\{([^}]*)\}/s)[1];

    for (const token of [
      '--study-week-card-padding',
      '--study-week-action-gap-top',
      '--study-week-action-gap-bottom',
    ]) {
      expect(card).toMatch(new RegExp(`${token}:\\s*[^;]+;`));
    }

    expect(card).toMatch(
      /padding:\s*var\(--study-week-card-padding\)\s+var\(--study-week-card-padding\)\s+var\(--study-week-action-gap-bottom\);/s,
    );
    expect(footer).toMatch(
      /padding-top:\s*var\(--study-week-action-gap-top\);/,
    );

    expect(footer).not.toMatch(/padding-top:\s*[\d.]/);
  });

  it('주차 상세는 개설 모달과 같은 시트 구조를 쓴다', () => {
    const source = read('pages/StudyDetail.jsx');
    const css = read('styles/studyDetail.css');

    expect(source).toContain('study-progress-sheet');
    expect(source).toContain('study-progress-scroll');
    expect(source).toMatch(/role="dialog"/);
    expect(source).toMatch(/aria-modal="true"/);
    expect(css).toMatch(
      /\.study-progress-scroll\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s,
    );
    const progressSheet = css.match(
      /\.study-progress-modal \.study-progress-sheet\s*\{([^}]*)\}/s,
    )[1];
    const recruitSheet = read('styles/studyRecruitModal.css').match(
      /\.study-recruit-modal \.study-recruit-sheet\s*\{([^}]*)\}/s,
    )[1];
    const pick = (block, prop) =>
      block.match(new RegExp(`${prop}:\\s*([^;]+);`))[1].trim();
    expect(pick(progressSheet, 'width')).toBe(pick(recruitSheet, 'width'));
    expect(pick(progressSheet, 'border-radius')).toBe(
      pick(recruitSheet, 'border-radius'),
    );
  });

  it('주차 상세 모달도 배경 스크롤을 잠그고 ESC 로 닫힌다', () => {
    const source = read('pages/StudyDetail.jsx');

    expect(source).toContain("document.body.style.overflow = 'hidden'");
    expect(source).toContain('document.body.style.overflow = previousOverflow');
    expect(source).toMatch(/event\.key === 'Escape'/);
  });

  it('스터디 태그는 목록·상세가 같은 공용 팔레트를 쓴다', () => {
    const list = read('pages/Study.jsx');
    const detail = read('pages/StudyDetail.jsx');

    for (const source of [list, detail]) {
      expect(source).toContain("from '../utils/helpers'");
      expect(source).toMatch(/tagColorClass\(tag\)/);
      expect(source).toContain('parseTags(');
      expect(source).not.toContain('getTagClassName');
      expect(source).not.toMatch(/colors\[index % colors\.length\]/);
    }
  });

  it('스터디 목록과 상세의 태그 줄이 같은 간격을 쓴다', () => {
    const appCss = read('App.css');
    const studyCss = read('styles/studyDetail.css');

    const gapOf = (css, selector) => {
      const block = css.match(
        new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`, 's'),
      );
      expect(block).not.toBeNull();
      const gap = block[1].match(/gap:\s*([^;]+);/);
      expect(gap).not.toBeNull();
      return gap[1].trim();
    };

    expect(gapOf(appCss, '.study-card-tags')).toBe(
      gapOf(studyCss, '.study-detail-tags'),
    );
  });

  it('태그 파싱은 # 를 떼고 중복을 없앤다', () => {
    const helpers = read('utils/helpers.js');

    expect(helpers).toContain('export const parseTags');
    expect(helpers).toMatch(/replace\(\/\^#\+\/, ''\)/);
    expect(helpers).toContain('new Set(');
    expect(helpers).toContain("const DEFAULT_TAG_CLASS = 'tag-architecture'");
  });

  it('목 서버가 주차별 진행 현황을 제공한다', () => {
    const mock = fs.readFileSync(
      path.join(SRC, '..', 'tools', 'mock-tech-articles-api.mjs'),
      'utf8',
    );

    expect(mock).toContain('const demoStudyProgress');
    expect(mock).toMatch(/\/\^\\\/api\\\/v1\\\/study\\\/\\d\+\\\/progress\$\//);
    expect(mock).toMatch(/https:\/\/example\.com\/tcp-study\/[^\s"`]{60,}/);
  });

  it('스터디 CTA 버튼은 공용 텍스트 색 토큰을 따른다', () => {
    const source = read('pages/StudyDetail.jsx');

    expect(source).not.toMatch(/cta-button[^"]*text-white/);
    expect(source).toMatch(/cta-button primary-cta-text/);
  });
});

describe('공용 태그 팔레트', () => {
  const exactRuleBody = (css, selector) => {
    const rules = [
      ...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@]+)\{([^{}]*)\}/g),
    ].filter((one) =>
      one[1]
        .split(',')
        .map((part) => part.trim())
        .includes(selector),
    );
    expect(rules.length).toBeGreaterThan(0);
    return rules.map((one) => one[2]).join('\n');
  };

  const rule = (css, selector) => {
    const block = exactRuleBody(css, selector);
    return {
      color: block.match(/color:\s*([^;]+);/)[1].trim(),
      background: block.match(/background:\s*([^;]+);/)[1].trim(),
    };
  };

  it('색 클래스는 tech articles 의 이름과 값을 그대로 쓴다', () => {
    const appCss = read('App.css');
    const taCss = read('styles/techArticlesPublic.css');

    const CATEGORIES = [
      'tag-ai-ml',
      'tag-data',
      'tag-data-db',
      'tag-cloud-devops',
      'tag-frontend',
      'tag-backend',
      'tag-mobile',
      'tag-security',
      'tag-open-source',
      'tag-language-framework',
      'tag-architecture',
      'tag-blockchain-web3',
      'tag-industry-career',
    ];

    CATEGORIES.forEach((category) => {
      expect({
        [category]: rule(appCss, `.${category}`),
      }).toEqual({
        [category]: rule(taCss, `.ta-public .${category}`),
      });
    });
  });

  it('태그 칩의 모양도 tech articles 와 같은 값을 쓴다', () => {
    const appCss = read('App.css');
    const taCss = read('styles/techArticlesPublic.css');

    const exactRuleBodies = (css, selector) =>
      [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
        .filter((rule) =>
          rule[1]
            .split(',')
            .map((one) => one.trim())
            .includes(selector),
        )
        .map((rule) => rule[2]);

    const props = (css, selector, keys) => {
      const bodies = exactRuleBodies(css, selector);
      expect(bodies.length).toBeGreaterThan(0);
      return Object.fromEntries(
        keys.map((key) => {
          const values = bodies
            .map(
              (body) =>
                (body.match(new RegExp(`(?:^|;|\\s)${key}:\\s*([^;]+);`)) || [])[1],
            )
            .filter(Boolean);
          return [key, values.length ? values[values.length - 1].trim() : undefined];
        }),
      );
    };

    const shared = ['border-radius', 'font-size', 'font-weight', 'gap'];
    expect(props(appCss, '.service-tag', shared)).toEqual(
      props(taCss, '.ta-public .tag-button', shared),
    );

    expect(props(appCss, '.service-tag', ['padding']).padding).toBe(
      props(taCss, '.ta-public .article-tag', ['padding']).padding,
    );

    const buttonKeys = ['min-height', 'padding'];
    expect(props(appCss, '.tag-btn.service-tag', buttonKeys)).toEqual(
      props(taCss, '.ta-public .tag-button', buttonKeys),
    );
  });

  it('태그 크기를 Tailwind 유틸리티로 덮어쓰지 않는다', () => {
    for (const file of [
      'components/public/TagMultiSelect.jsx',
      'pages/Members.jsx',
      'components/TeamCard.jsx',
    ]) {
      expect(read(file)).not.toMatch(/px-\d[^"`]*rounded-full/);
    }
  });

  it('분류에 없는 태그도 색이 지정된 기본 클래스로 떨어진다', () => {
    const appCss = read('App.css');
    const helpers = read('utils/helpers.js');

    const fallback = helpers.match(
      /const DEFAULT_TAG_CLASS = '([^']+)'/,
    )[1];
    expect(rule(appCss, `.${fallback}`).color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(rule(appCss, `.${fallback}`).background).toMatch(/^rgba\(/);
  });
});

describe('멤버 페이지 태그 필터', () => {
  it('필터 후보를 하드코딩하지 않고 실제 멤버 태그에서 만든다', () => {
    const source = read('pages/Members.jsx');

    expect(source).toContain('const availableTags = useMemo(');
    expect(source).toContain('tags={availableTags}');
    expect(source).not.toMatch(/tags=\{\[\s*'React'/);
    expect(source).toMatch(/members\.forEach/);
  });

  it('사라진 태그가 선택된 채로 남지 않는다', () => {
    const source = read('pages/Members.jsx');

    expect(source).toMatch(/availableTags\.includes\(tag\)/);
    expect(source).toMatch(/\}, \[availableTags\]\);/);
  });
});
