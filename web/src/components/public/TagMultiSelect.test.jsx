import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TagMultiSelect from './TagMultiSelect';

test('세 번째 줄부터 숨기고 펼치기와 접기로 표시를 전환한다', () => {
  const top = jest.spyOn(HTMLElement.prototype, 'offsetTop', 'get')
    .mockImplementation(function () { return this.textContent === 'Rust' ? 56 : 0; });
  // Three distinct rows, independent of the test DOM's lack of layout.
  top.mockImplementation(function () {
    return ({ React: 0, Python: 28, Rust: 56 })[this.textContent] || 0;
  });
  const height = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(22);
  try {
    render(<TagMultiSelect tags={['React', 'Python', 'Rust']} selectedTags={[]}
      onToggle={() => {}} onReset={() => {}} getTagClassName={() => ''}
      ariaLabel="태그" collapsedRows={2} />);
    expect(screen.queryByRole('button', { name: 'Rust' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /태그 더 보기/ }));
    expect(screen.getByRole('button', { name: 'Rust' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /태그 접기/ }));
    expect(screen.queryByRole('button', { name: 'Rust' })).not.toBeInTheDocument();
  } finally {
    top.mockRestore();
    height.mockRestore();
  }
});
