export const tagColorClass = (tag) => {
  const map = {
    AI: 'bg-blue-900 text-blue-300',
    해커톤: 'bg-yellow-900 text-yellow-300',
    프론트엔드: 'bg-green-900 text-green-300',
    백엔드: 'bg-purple-900 text-purple-300',
    공모전: 'bg-pink-900 text-pink-300',
    초보환영: 'bg-gray-700 text-gray-300',
    프로젝트: 'bg-indigo-900 text-indigo-300',
    알고리즘: 'bg-red-900 text-red-300',
  };
  return map[tag] || 'bg-gray-700 text-gray-300';
};

export const isExpired = (deadline) => {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  // Compare by date only
  return d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
};
