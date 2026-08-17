(() => {
  "use strict";

  const page = document.body.dataset.page;
  let toastTimer;

  function showToast(message, iconClass = "fa-circle-info") {
    const toast = document.querySelector("#toast");
    if (!toast) return;

    let icon = toast.querySelector("i");
    let copy = toast.querySelector("p");
    if (!icon) {
      icon = document.createElement("i");
      icon.setAttribute("aria-hidden", "true");
      toast.prepend(icon);
    }
    if (!copy) {
      copy = document.createElement("p");
      toast.append(copy);
    }

    icon.className = `fas ${iconClass}`;
    copy.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  function bindDemoControls() {
    document
      .querySelectorAll(".demo-link, [data-demo-link]")
      .forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          showToast("이 목업에서는 Tech Articles 관련 화면만 동작합니다.");
        });
      });

    document
      .querySelectorAll(".demo-action, [data-demo-action]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          showToast("팀 검토용 목업에서는 이 기능을 실행하지 않습니다.");
        });
      });
  }

  function bindPublicHeader() {
    const menuButton = document.querySelector("#menuButton");
    const mobileNav = document.querySelector("#mobileNav");
    if (!menuButton || !mobileNav) return;

    const closeMenu = () => {
      mobileNav.hidden = true;
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "모바일 메뉴 열기");
      menuButton.querySelector("i").className = "fas fa-bars";
    };

    menuButton.addEventListener("click", () => {
      const willOpen = mobileNav.hidden;
      mobileNav.hidden = !willOpen;
      menuButton.setAttribute("aria-expanded", String(willOpen));
      menuButton.setAttribute("aria-label", willOpen ? "모바일 메뉴 닫기" : "모바일 메뉴 열기");
      menuButton.querySelector("i").className = willOpen ? "fas fa-times" : "fas fa-bars";
    });

    mobileNav.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 1280) closeMenu();
    });
  }

  function renderMarkdown(markdown, target) {
    const normalized = markdown.replace(/\r\n?/g, "\n").trim();
    if (!normalized) {
      target.textContent = "표시할 요약이 없습니다.";
      return;
    }

    if (typeof window.markdownit !== "function" || !window.DOMPurify?.sanitize) {
      target.textContent = normalized;
      return;
    }

    const renderer = window.markdownit({
      html: false,
      linkify: false,
      breaks: false,
      typographer: false,
    });
    renderer.validateLink = (value) => {
      try {
        const url = new URL(value, window.location.href);
        return ["http:", "https:"].includes(url.protocol);
      } catch {
        return false;
      }
    };

    const normalizeHeading = (defaultRule) =>
      (tokens, index, options, environment, markdownRenderer) => {
        const level = Number.parseInt(tokens[index].tag.slice(1), 10);
        tokens[index].tag = `h${Math.min(6, Math.max(3, level))}`;
        return defaultRule
          ? defaultRule(tokens, index, options, environment, markdownRenderer)
          : markdownRenderer.renderToken(tokens, index, options);
      };
    renderer.renderer.rules.heading_open = normalizeHeading(renderer.renderer.rules.heading_open);
    renderer.renderer.rules.heading_close = normalizeHeading(renderer.renderer.rules.heading_close);

    const defaultLinkOpen = renderer.renderer.rules.link_open;
    renderer.renderer.rules.link_open = (tokens, index, options, environment, markdownRenderer) => {
      tokens[index].attrSet("target", "_blank");
      tokens[index].attrSet("rel", "noopener noreferrer");
      return defaultLinkOpen
        ? defaultLinkOpen(tokens, index, options, environment, markdownRenderer)
        : markdownRenderer.renderToken(tokens, index, options);
    };

    target.innerHTML = window.DOMPurify.sanitize(renderer.render(normalized), {
      ALLOWED_TAGS: [
        "p",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "strong",
        "em",
        "code",
        "pre",
        "a",
        "blockquote",
        "hr",
        "br",
      ],
      ALLOWED_ATTR: ["href", "title", "target", "rel", "class"],
    });
  }

  function initDetailPage() {
    const summaryTarget = document.querySelector("#summaryBody");
    const summarySource = document.querySelector("#summaryMarkdown");
    if (summaryTarget && summarySource) renderMarkdown(summarySource.textContent, summaryTarget);
    bindPublicHeader();
    bindDemoControls();
  }

  if (page === "detail") initDetailPage();
})();
