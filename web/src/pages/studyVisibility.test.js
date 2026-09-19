const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('스터디 공개 목록과 참여 인원 표시', () => {
  it('상세 응답의 참여 인원 수를 멤버 목록보다 우선 사용한다', () => {
    const source = read('pages/StudyDetail.jsx');

    expect(source).toMatch(
      /memberCount:\s*data\.members_count\s*\?\?\s*\(data\.members\s*\|\|\s*\[\]\)/,
    );
  });
});
