const fs = require('fs');
const path = require('path');

describe('홈과 About 통합', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
  const headerSource = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'Header.jsx'),
    'utf8',
  );
  const aboutSource = fs.readFileSync(path.join(__dirname, 'About.jsx'), 'utf8');

  test('About을 기본 화면으로 사용하고 이전 주소는 홈으로 이동한다', () => {
    expect(appSource).toContain('<Route path="/" element={<About />} />');
    expect(appSource).toContain(
      '<Route path="/about" element={<Navigate to="/" replace />} />',
    );
    expect(appSource).not.toContain('./pages/Home');
    expect(fs.existsSync(path.join(__dirname, 'Home.jsx'))).toBe(false);
  });

  test('데스크톱과 모바일 내비게이션에서 About이 홈으로 연결된다', () => {
    const aboutLinks = headerSource.match(/to=["']\/about["']/g) || [];

    expect(aboutLinks).toHaveLength(2);
  });

  test('주요 활동은 현재 현황과 연도별 히스토리 사이에 배치한다', () => {
    const statusIndex = aboutSource.indexOf('현재 현황');
    const activitiesIndex = aboutSource.indexOf('<ActivityHighlights />');
    const historyIndex = aboutSource.lastIndexOf('연도별 활동 히스토리');

    expect(statusIndex).toBeGreaterThan(-1);
    expect(activitiesIndex).toBeGreaterThan(statusIndex);
    expect(historyIndex).toBeGreaterThan(activitiesIndex);
  });
});
