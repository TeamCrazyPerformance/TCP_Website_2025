const fs = require('fs');
const path = require('path');

describe('공개 페이지 모바일 문구', () => {
  test('공지 소개 문구는 모바일에서 요청한 세 줄로 나뉜다', () => {
    const source = fs.readFileSync(path.join(__dirname, 'Announcement.jsx'), 'utf8');
    const copy = source.slice(
      source.indexOf('동아리 운영, 행사, 프로젝트 등'),
      source.indexOf('이곳에서 확인할 수 있어요.') + '이곳에서 확인할 수 있어요.'.length,
    );

    expect(copy).toContain('동아리 운영, 행사, 프로젝트 등');
    expect(copy).toContain('TCP의 모든 공식 공지사항을');
    expect(copy.match(/announcement-mobile-break/g)).toHaveLength(2);
  });

  test('Recruitment 소개 문구는 개행이 사라져도 쉼표 뒤 띄어쓰기를 유지한다', () => {
    const source = fs.readFileSync(path.join(__dirname, 'Recruitment.jsx'), 'utf8');

    expect(source).toMatch(
      /TCP는 다양한 사람이 모여 같이 탐구하고,\s*<br className="recruitment-about-mobile-break" \/>\s*\{' '\}함께 성장하는 것을 목표로 합니다\./s,
    );
  });
});
