const TAG_CLASS_NAMES = {
  AI: "tag-ai-ml",
  "애플리케이션 개발": "tag-frontend",
  모바일: "tag-mobile",
  "프로그래밍 언어": "tag-language-framework",
  데이터: "tag-data-db",
  클라우드: "tag-cloud",
  DevOps: "tag-devops",
  보안: "tag-security",
  네트워크: "tag-backend",
  "소프트웨어 아키텍처": "tag-architecture",
  "개발자 도구": "tag-developer-tools",
  "소프트웨어 품질": "tag-software-quality",
  오픈소스: "tag-open-source",
  "개발 조직": "tag-development-organization",
  "산업 동향": "tag-industry-trends",
};

export function v9TagClassName(tag) {
  return TAG_CLASS_NAMES[tag] || "tag-architecture";
}
