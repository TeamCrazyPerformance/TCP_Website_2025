export const tagColorClass = (tag) => {
  const map = {
    AI: 'service-tag-tone-01',
    'AI/ML': 'service-tag-tone-01',
    TensorFlow: 'service-tag-tone-01',
    PyTorch: 'service-tag-tone-01',
    'Machine Learning': 'service-tag-tone-01',
    React: 'service-tag-tone-02',
    JavaScript: 'service-tag-tone-04',
    TypeScript: 'service-tag-tone-08',
    CSS: 'service-tag-tone-10',
    프론트엔드: 'service-tag-tone-02',
    'Vue.js': 'service-tag-tone-11',
    Swift: 'service-tag-tone-03',
    Flutter: 'service-tag-tone-07',
    Kotlin: 'service-tag-tone-12',
    모바일: 'service-tag-tone-03',
    Java: 'service-tag-tone-06',
    Python: 'service-tag-tone-05',
    알고리즘: 'service-tag-tone-04',
    MySQL: 'service-tag-tone-12',
    'Data Science': 'service-tag-tone-13',
    AWS: 'service-tag-tone-06',
    Django: 'service-tag-tone-14',
    Spring: 'service-tag-tone-15',
    'Node.js': 'service-tag-tone-09',
    백엔드: 'service-tag-tone-09',
    프로젝트: 'service-tag-tone-10',
    초보환영: 'service-tag-tone-13',
    공모전: 'service-tag-tone-14',
    해커톤: 'service-tag-tone-15',
  };
  return `service-tag ${map[tag] || 'service-tag-tone-10'}`;
};

export const isExpired = (deadline) => {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  // Compare by date only
  return d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
};
