import os, re, sys

# 목업 원본은 docs/ 아래에 둔다 (docs/study-mockup 선례). 수정하지 않는다.
# 목업에 없던 스타일은 src/styles/techArticlesAdminAlign.css 에 작성한다.
SRC = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "tech-articles-v9-mockup"
)

# v9 목업 CSS 를 화면별 스코프 번들로 변환하는 스크립트입니다.
#
#   python3 tools/scope_v9.py admin  > src/styles/techArticlesAdmin.css   (.ta-admin)
#   python3 tools/scope_v9.py public > src/styles/techArticlesPublic.css  (.ta-public)
#
# 두 타깃은 공통 체인(styles-base -> list-v2 -> list-v3 -> styles)을 공유하고
# 마지막 파일만 다릅니다. @import 체인은 평탄화됩니다.
COMMON = ["styles-base.css", "styles-list-v2.css", "styles-list-v3.css", "styles.css"]

# 목업 자체 셸(사이드바·토픽바) -> AdminLayout + AdminSidebar 로 대체. 사문 규칙 제거.
ADMIN_DEAD = {
    "admin-shell","admin-body","admin-workspace","admin-topbar","admin-topbar-inner",
    "admin-sidebar","admin-sidebar-backdrop","admin-brand","admin-brand-link",
    "admin-brand-logo","admin-brand-copy","admin-navigation","admin-page-title",
    "admin-account-actions","admin-home-link","admin-user-name","admin-logout-button",
    "admin-main","admin-content","admin-page-heading",
    "sidebar","sidebar-group","sidebar-group-label","sidebar-link","sidebar-sub-link",
    "sidebar-subnav","sidebar-section-title","sidebar-count","sidebar-toggle",
    "sidebar-is-open","skip-link",
    "container",          # 관리자는 Tailwind .container 를 쓰므로 충돌 방지
    "admin-boot-state",
}

# 목업 자체 사이트 헤더·푸터 -> 공용 Header/Footer 로 대체.
# .container 는 공개 본문(page-hero 등)이 실제로 쓰므로 유지. 스코프 안이라 충돌 없음.
PUBLIC_DEAD = {
    "site-header","header-container","header-inner","header-brand-slot",
    "header-actions","brand","brand-logo-box","brand-copy",
    "desktop-nav","mobile-nav","menu-button","auth-links",
    "login-button","register-button",
    "site-footer","footer-grid","footer-brand","copyright",
    "skip-link","admin-body",
    # 셸은 아니지만 React 화면에서 사라진 마크업. 히어로 설명 문단은
    # hero-lead 한 줄로 합쳐졌고, 목업에만 남아 있다.
    "hero-description",
    # 상세 히어로의 출처·게시 시각 줄. 같은 정보를 사이드바 출처 카드가
    # 싣고 있어 제거했고, 남은 것은 원문 링크와 태그뿐이다.
    "detail-info-item","detail-source-item","detail-info-label",
}

TARGETS = {
    "admin":  {"files": COMMON + ["admin-v9.css"],  "scope": ".ta-admin",  "dead": ADMIN_DEAD},
    "public": {"files": COMMON + ["public-v9.css"], "scope": ".ta-public", "dead": PUBLIC_DEAD},
}

target = sys.argv[1] if len(sys.argv) > 1 else "admin"
if target not in TARGETS:
    sys.exit(f"사용법: scope_v9.py [admin|public]  (받은 값: {target})")
CONF = TARGETS[target]
ORDER = CONF["files"]
SCOPE = CONF["scope"]
DEAD = CONF["dead"]

def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)

def tokenize(css):
    """(head, body, is_atrule) 리스트로 최상위 분해"""
    out, i, n = [], 0, len(css)
    while i < n:
        depth = 0
        j = i
        while j < n and css[j] not in "{;":
            j += 1
        if j >= n:
            break
        if css[j] == ";":            # @import 등 blockless at-rule
            out.append((css[i:j].strip(), None, True))
            i = j + 1
            continue
        head = css[i:j].strip()
        depth = 1
        k = j + 1
        while k < n and depth:
            if css[k] == "{": depth += 1
            elif css[k] == "}": depth -= 1
            k += 1
        body = css[j+1:k-1]
        out.append((head, body, head.startswith("@")))
        i = k
    return out

def selector_classes(sel):
    return set(re.findall(r"\.([A-Za-z0-9_-]+)", sel))

def prefix_selector(sel):
    sel = sel.strip()
    if not sel:
        return None
    if sel == ":root":
        return SCOPE
    if sel in ("html", "body"):
        return None                      # 전역 오염 방지. BASE 블록으로 대체
    if selector_classes(sel) & DEAD:
        return None                      # 사문 셸 규칙
    return f"{SCOPE} {sel}"

def split_selectors(group):
    """최상위 콤마로만 분리 (괄호 깊이 고려)"""
    parts, depth, buf = [], 0, ""
    for ch in group:
        if ch in "([": depth += 1
        elif ch in ")]": depth -= 1
        if ch == "," and depth == 0:
            parts.append(buf); buf = ""
        else:
            buf += ch
    if buf.strip(): parts.append(buf)
    return parts

def transform(nodes, inside_keyframes=False):
    chunks = []
    for head, body, is_at in nodes:
        if body is None:
            if head.lower().startswith("@import"):
                continue                 # 체인 평탄화
            chunks.append(head + ";")
            continue
        if is_at:
            low = head.lower()
            if low.startswith("@keyframes") or low.startswith("@-webkit-keyframes"):
                chunks.append(head + " {" + body + "}")   # 내부 셀렉터 보존
                continue
            if low.startswith(("@media", "@supports", "@layer")):
                inner = transform(tokenize(body))
                if inner.strip():
                    chunks.append(head + " {\n" + inner + "\n}")
                continue
            chunks.append(head + " {" + body + "}")
            continue
        kept = [p for p in (prefix_selector(s) for s in split_selectors(head)) if p]
        if not kept:
            continue
        chunks.append(",\n".join(kept) + " {" + body + "}")
    return "\n".join(chunks)

# 주의: 구분 주석을 CSS 스트림에 넣으면 첫 셀렉터에 붙음. 이어붙인 뒤 일괄 제거.
raw = []
for name in ORDER:
    with open(os.path.join(SRC, name)) as f:
        raw.append(f.read())
css = strip_comments("\n".join(raw))

BASE = f"""/* 목업 body 규칙을 스코프 루트로 옮깁니다. 전역 오염 방지. */
{SCOPE} {{
  color: #fff;
  font-family: "Spoqa Han Sans Neo", sans-serif;
  line-height: 1.5;
  word-break: keep-all;
  text-align: start;
}}
"""

out = transform(tokenize(css))
ALIGN_FILE = {"admin": "techArticlesAdminAlign.css",
              "public": "techArticlesPublicAlign.css"}[target]
CHROME_NOTE = {
    "admin": "사문 셸 규칙 제거",
    "public": "사문 사이트 헤더·푸터 규칙 제거",
}[target]
HEADER = f"""/* 이 파일은 자동 생성됩니다. 직접 수정하지 말아 주세요.
 *
 * 재생성: python3 tools/scope_v9.py {target}
 * 원본:   docs/tech-articles-v9-mockup/
 * 조정:   {ALIGN_FILE} 에 작성해 주세요.
 *
 * v9 목업 CSS 를 {SCOPE} 하위로 스코프해 기존 서비스와 격리합니다.
 * @import 체인 평탄화 / :root -> {SCOPE} / html·body 규칙 제거 / {CHROME_NOTE}
 */
"""
sys.stdout.write(HEADER + "\n" + BASE + "\n" + out + "\n")
