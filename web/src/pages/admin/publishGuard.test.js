/* 공개 토글 가드가 모든 경로에 걸려 있는지 검증합니다.
 *
 * 표 뷰와 모바일 카드 뷰에 토글이 중복 존재했고, 한쪽만 고치면
 * 다른 쪽으로 우회됩니다. 토글 구현을 PublishControl 하나로 모으고
 * 그 전제를 여기서 고정합니다. */
const fs = require("fs");
const path = require("path");

const SOURCE = fs.readFileSync(
  path.join(__dirname, "AdminTechArticles.jsx"),
  "utf8",
);

describe("공개 토글 가드", () => {
  test("공개 토글 구현이 PublishControl 하나뿐이다", () => {
    // 공개 토글 1개 + 행 선택 2개(표, 모바일 카드) + 전체 선택 1개.
    // 늘었다면 가드 없는 토글이 생겼을 가능성이 큼.
    const checkboxes = SOURCE.match(/type="checkbox"/g) || [];
    expect(checkboxes.length).toBe(4);
    expect((SOURCE.match(/<PublishControl/g) || []).length).toBe(2);
  });

  test("토글이 처리 상태로 비활성화된다", () => {
    expect(SOURCE).toMatch(/const blockReason = publishBlockReason\(article\)/);
    expect(SOURCE).toMatch(/disabled=\{isMutating \|\| blocked\}/);
  });

  test("이미 공개된 아티클을 내리는 길은 막지 않는다", () => {
    expect(SOURCE).toMatch(
      /const blocked = !published && Boolean\(blockReason\)/,
    );
  });

  test("단건 실행에도 서버 호출 전 가드가 있다", () => {
    expect(SOURCE).toMatch(
      /action === "PUBLISH" && !canPublishArticle\(article\)/,
    );
  });

  test("일괄 공개가 대상을 분리하고 제외 건수를 알린다", () => {
    expect(SOURCE).toMatch(/partitionPublishable\(selectedRecords\)/);
    // 확인 모달과 결과 알림 모두 blocked 를 언급
    expect(SOURCE).toMatch(/blocked\.length[\s\S]{0,200}제외/);
    expect(SOURCE).toMatch(/제외했습니다/);
  });

  test("일괄 요청 본문이 선택 전체가 아니라 공개 가능 건만 담는다", () => {
    expect(SOURCE).toMatch(/publishable\.map\(\(article\) => \(\{/);
    expect(SOURCE).not.toMatch(/selectedRecords\.map\(\(article\) => \(\{/);
  });

  test("상태 라벨을 공용 어휘에서 가져온다", () => {
    expect(SOURCE).toMatch(
      /from "\.\.\/\.\.\/components\/tech-articles\/techArticleStatus"/,
    );
    // 영문 enum 을 그대로 출력하던 자리
    expect(SOURCE).not.toMatch(/value=\{detail\.processingStatus\}/);
    expect(SOURCE).not.toMatch(/value=\{detail\.reviewStatus\}/);
    expect(SOURCE).not.toMatch(/value=\{detail\.publicationStatus\}/);
  });
});
