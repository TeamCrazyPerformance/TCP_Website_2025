const fs = require("fs");
const path = require("path");

const numericConstant = (source, name) => {
  const match = source.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
  if (!match) throw new Error(`${name} not found`);
  return Number(match[1]);
};

test("목 서버의 NEW 기준이 파이프라인과 같다", () => {
  const mockSource = fs.readFileSync(
    path.resolve(__dirname, "../../tools/mock-tech-articles-api.mjs"),
    "utf8",
  );
  const pipelineSource = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../tech-article-pipeline/core/src/tech_article_pipeline/persistence/base.py",
    ),
    "utf8",
  );

  expect(numericConstant(mockSource, "NEW_ARTICLE_WINDOW_HOURS")).toBe(
    numericConstant(pipelineSource, "NEW_ARTICLE_WINDOW_HOURS"),
  );
  expect(mockSource).toMatch(
    /isNewArticle\(a\.collectedAt,\s*a\.originalPublishedAt\)/,
  );
});

test("목 서버가 만드는 태그 개수가 파이프라인 상한을 넘지 않는다", () => {
  const mockSource = fs.readFileSync(
    path.resolve(__dirname, "../../tools/mock-tech-articles-api.mjs"),
    "utf8",
  );
  const contractSource = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../tech-article-pipeline/core/src/tech_article_pipeline/contracts/models.py",
    ),
    "utf8",
  );

  const mockRange = mockSource.match(
    /tags:\s*pickN\(TAGS,\s*intBetween\((\d+),\s*(\d+)\)\)/,
  );
  if (!mockRange) throw new Error("목 서버의 태그 생성 규칙을 찾지 못했습니다");
  const contractMaximum = contractSource.match(
    /maximum_tag_count[^\n]*default=(\d+)/,
  );
  if (!contractMaximum) throw new Error("maximumTagCount 기본값을 찾지 못했습니다");

  const [, lower, upper] = mockRange.map(Number);
  expect(lower).toBeGreaterThanOrEqual(1);
  expect(upper).toBeLessThanOrEqual(Number(contractMaximum[1]));
});

test("목 서버 공개 목록이 운영 Tech Articles와 유사한 데이터 구성을 제공한다", () => {
  const mockSource = fs.readFileSync(
    path.resolve(__dirname, "../../tools/mock-tech-articles-api.mjs"),
    "utf8",
  );

  expect(mockSource).toMatch(/MOCK_PUBLIC_ARTICLE_COUNT \|\| 106/);
  expect(mockSource).toContain(
    "DoorDash의 Flux, 클라우드 기반 에이전트로 13만 건의 엔지니어링 작업 처리",
  );
  expect(mockSource).toContain("Tailscale Blog");
  expect(mockSource).toContain("GitHub Trending");
  expect(
    (mockSource.match(/articleId: "article-202608/g) || []).length,
  ).toBeGreaterThanOrEqual(20);
});
