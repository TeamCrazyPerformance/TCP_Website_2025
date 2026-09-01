const fs = require("fs");
const path = require("path");

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, relativePath), "utf8");

describe("common CTA text color", () => {
  it("defines and applies the shared #25223D text color", () => {
    const indexCss = readSource("../index.css");
    const appCss = readSource("../App.css");

    expect(indexCss).toMatch(/--cta-text-color:\s*#25223d;/i);
    expect(indexCss).toMatch(
      /\.cta-button\s*\{[^}]*color:\s*var\(--cta-text-color\);/s,
    );
    expect(indexCss).toMatch(
      /\.cta-button:hover\s*\{[^}]*color:\s*var\(--cta-text-color\);/s,
    );
    expect(appCss).toMatch(
      /\.primary-cta-text\s*\{[^}]*color:\s*var\(--cta-text-color\);/s,
    );
  });

  it.each(["techArticlesPublic.css", "techArticlesAdmin.css"])(
    "keeps %s CTA states on the shared text color",
    (file) => {
      const css = readSource(file);

      expect(css).toMatch(
        /\.ta-(?:public|admin) \.cta-button\s*\{[^}]*color:\s*var\(--cta-text-color\);/s,
      );
      expect(css).toMatch(
        /\.ta-(?:public|admin) \.cta-button:hover\s*\{[^}]*color:\s*var\(--cta-text-color\);/s,
      );
    },
  );

  it("uses the shared color in the image editor action button", () => {
    const component = readSource("../components/common/ImageEditorModal.jsx");

    expect(component).toMatch(
      /className="cta-button"[\s\S]*?color:\s*'var\(--cta-text-color\)'/,
    );
  });
});
