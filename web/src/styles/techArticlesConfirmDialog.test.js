const fs = require("fs");
const path = require("path");

test("관리자 확인창은 내용 높이로 중앙 배치하고 긴 내용만 스크롤한다", () => {
  const css = fs.readFileSync(path.join(__dirname, "techArticlesAdmin.css"), "utf8");
  const dialog = css.match(/\.ta-admin \.confirm-dialog\s*\{([^}]+)\}/)[1];
  expect(dialog).toMatch(/height:\s*fit-content;/);
  expect(dialog).toMatch(/margin:\s*auto;/);
  expect(dialog).toMatch(/inset:\s*0;/);
  expect(dialog).toMatch(/max-height:\s*min\(86dvh, 820px\);/);
  expect(dialog).toMatch(/overflow-y:\s*auto;/);
  expect(css).toMatch(/\.ta-admin \.confirm-dialog \.dialog-panel\s*\{[^}]*max-height:\s*none;/);
});
