const normalizeTag = (tag) => String(tag ?? '').trim().replace(/^#+/, '').trim();

// Colors live in App.css. This map only decides which field a tag belongs to.
const TAG_CATEGORY = {
  'tag-ai-ml': [
    'AI', 'AI/ML', '머신러닝', '딥러닝', '생성형AI', 'Machine Learning',
    'TensorFlow', 'PyTorch', '데이터분석', '데이터',
  ],
  'tag-data-db': [
    '데이터베이스', 'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis',
  ],
  'tag-frontend': [
    '프론트엔드', '웹개발', 'React', 'Next.js', 'Vue.js', 'Svelte',
    'JavaScript', 'CSS', 'HTML', 'UI/UX',
  ],
  'tag-backend': [
    '백엔드', '서버', '네트워크', 'Node.js', 'Node.JS', 'NestJS', 'Express',
    'Spring', 'Django', 'FastAPI', 'GraphQL',
  ],
  'tag-mobile': [
    '모바일', 'iOS', 'Android', 'Swift', 'Kotlin', 'Flutter', 'React Native',
  ],
  'tag-language-framework': [
    '프로그래밍', '프로그래밍 언어', 'Java', 'Python', '파이썬', 'TypeScript',
    'C', 'C++', 'C#', 'Go', 'Rust', '알고리즘', '자료구조', '코딩테스트',
  ],
  'tag-cloud-devops': [
    '클라우드', 'DevOps', '데브옵스', '인프라', 'AWS', 'GCP', 'Azure',
    'Docker', 'Kubernetes', 'CI/CD',
  ],
  'tag-security': ['보안', 'Security', '해킹'],
  'tag-open-source': ['오픈소스', '초보환영', '입문', '초급'],
  'tag-architecture': ['소프트웨어 아키텍처', '아키텍처', '설계', '심화', '풀스택'],
  'tag-industry-career': [
    '해커톤', '공모전', '프로젝트', '스터디', '취업', '커리어', '산업 동향',
  ],
};

const TAG_CLASS_BY_NAME = new Map(
  Object.entries(TAG_CATEGORY).flatMap(([className, tags]) =>
    tags.map((tag) => [tag.toLowerCase(), className]),
  ),
);

// Same fallback as v9TagClassName on the tech articles page.
const DEFAULT_TAG_CLASS = 'tag-architecture';

export const tagColorClass = (tag) => {
  const name = normalizeTag(tag).toLowerCase();
  return `service-tag ${TAG_CLASS_BY_NAME.get(name) || DEFAULT_TAG_CLASS}`;
};

// The create form used to suggest "#React", so stored tags may carry a leading #.
export const parseTags = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map(normalizeTag).filter(Boolean))];
  }
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(',').map(normalizeTag).filter(Boolean))];
};

export const isExpired = (deadline) => {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  // Compare by date only
  return d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
};
