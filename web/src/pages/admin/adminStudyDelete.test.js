const fs = require("fs");
const path = require("path");

describe("관리자 스터디 삭제", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "AdminStudy.jsx"),
    "utf8",
  );

  test("관련 데이터 삭제를 백엔드의 단일 요청에 맡긴다", () => {
    expect(source).toContain("import { apiDelete } from '../../api/client';");
    expect(source).toContain("await apiDelete(`/api/v1/study/${studyId}`);");
    expect(source).not.toContain("Cascade Delete Manually");
    expect(source).not.toContain("/resources/${resource.id}");
    expect(source).not.toContain("/progress/${item.id}");
    expect(source).not.toContain("/members/${member.user_id}");
  });
});
