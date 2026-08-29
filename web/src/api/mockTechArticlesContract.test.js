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
});
