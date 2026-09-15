import { v9TagClassName } from "./techArticleTags";

const fs = require("fs");
const path = require("path");

test("관리자 태그 배경색은 공개 아티클의 15개 분야 색상과 같다", () => {
  const read = (name) => fs.readFileSync(path.join(__dirname, "../../styles", name), "utf8");
  const publicCss = read("techArticlesPublicAlign.css");
  const adminCss = read("techArticlesAdminAlign.css");
  const tones = Object.fromEntries([...publicCss.matchAll(/--article-tag-tone-(\d+): (#[\da-f]+);/g)].map((match) => [match[1], match[2]]));
  const rules = [...publicCss.matchAll(/\.ta-public \.(tag-[\w-]+) \{\s*--article-tag-background: var\(--article-tag-tone-(\d+)\);\s*\}/g)].filter((match) => match[1] !== "tag-more");
  expect(rules).toHaveLength(15);
  for (const [, className, tone] of rules) {
    expect(adminCss).toContain(`.ta-admin .admin-article-tags .article-tag.${className} {\n  color: #111827;\n  background: ${tones[tone]};`);
  }
  expect(v9TagClassName("데이터")).toBe("tag-data-db");
  expect(v9TagClassName("미등록 분야")).toBe("tag-architecture");
});
