import { tagColor, tagColorStyle } from './tagPalette';

describe('tagColor', () => {
  it('keeps a tag color stable and distributes unrelated study tags', () => {
    const tags = [
      'React',
      'Spring',
      '알고리즘',
      '운영체제',
      '네트워크',
      '데이터베이스',
      '컴퓨터 그래픽스',
      '보안',
    ];

    expect(tagColor('React')).toBe(tagColor('React'));
    expect(new Set(tags.map(tagColor)).size).toBeGreaterThanOrEqual(6);
    expect(tagColorStyle('React')).toEqual({
      '--service-filter-tag-background': tagColor('React'),
    });
  });
});
