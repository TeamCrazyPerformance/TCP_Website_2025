const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('관리자 사이드바 홈 이동', () => {
  it('로고 영역을 홈페이지 링크로 제공한다', () => {
    const source = read('components/AdminSidebar.jsx');

    expect(source).toMatch(/<Link[\s\S]*?to="\/"[\s\S]*?aria-label="TCP 홈페이지로 이동"/);
    expect(source).toContain('alt="TCP 로고"');
  });
});
