const fs = require('fs');
const path = require('path');

describe('Home 단일 화면과 About 리다이렉트', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
  const headerSource = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'Header.jsx'),
    'utf8',
  );
  const aboutSource = fs.readFileSync(path.join(__dirname, 'About.jsx'), 'utf8');

  test('Home은 현재 브랜드 히어로를 유지하고 About 주소는 Home으로 이동한다', () => {
    expect(appSource).toContain('<Route path="/" element={<About />} />');
    expect(appSource).toContain('<Route path="/about" element={<Navigate to="/" replace />} />');
    expect(appSource).not.toContain('<Route path="/about" element={<About />} />');
    expect(aboutSource).toContain('function About()');
    expect(aboutSource).toContain('className="home-brand-hero pt-24 pb-16 min-h-screen flex items-center"');
    expect(aboutSource).not.toContain('function About({ isHome');
    expect(appSource).not.toContain('./pages/Home');
    expect(fs.existsSync(path.join(__dirname, 'Home.jsx'))).toBe(false);
  });

  test('데스크톱과 모바일 내비게이션의 About 항목을 유지한다', () => {
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
