const TAG_COLORS = ['#c978a9', '#a99fb4', '#d9cde5', '#9b89a8', '#a684a7', '#a181af', '#a17eba', '#758f9f', '#6fb8aa', '#808b89', '#75aea4', '#579c8f', '#7ba672', '#8ba0d6', '#9dc3d8'];

export const tagColor = (tag) => {
  let hash = 2166136261;
  for (const character of String(tag ?? '').trim().toLowerCase()) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  }
  return TAG_COLORS[(hash >>> 0) % TAG_COLORS.length];
};

export const tagColorStyle = (tag) => ({
  '--service-filter-tag-background': tagColor(tag),
});

export const createTagColors = (tags) => new Map(
  [...new Set(tags)].sort((a, b) => a.localeCompare(b, 'ko'))
    .map((tag, index) => [tag, TAG_COLORS[index % TAG_COLORS.length]])
);
