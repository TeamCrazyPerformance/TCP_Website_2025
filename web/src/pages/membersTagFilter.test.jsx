import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { apiGet } from '../api/client';
import Members from './Members';

jest.mock('../api/client', () => ({ apiGet: jest.fn() }));
jest.mock('../hooks/useScrollReveal', () => ({ useScrollReveal: jest.fn() }));

test('실제 멤버 태그만 후보로 제공하고 정리된 태그로 멤버를 검색한다', async () => {
  apiGet.mockResolvedValue([
    { name: '현재 멤버', education_status: '재학', tech_stack: [' #React ', 'React', '', '새로운 스택'] },
    { name: '졸업 멤버', education_status: '졸업', tech_stack: ' Python, #React ' },
    { name: '태그 없는 멤버', education_status: '재학', tech_stack: null },
  ]);
  render(<Members />);

  const react = await screen.findByRole('button', { name: 'React' });
  const filter = screen.getByLabelText('멤버 태그 필터');
  expect(within(filter).getAllByRole('button')).toHaveLength(3);
  expect(within(filter).getByRole('button', { name: '새로운 스택' })).toBeInTheDocument();
  expect(within(filter).queryByRole('button', { name: 'JavaScript' })).not.toBeInTheDocument();

  fireEvent.click(react);
  expect(screen.getByRole('heading', { name: '현재 멤버', level: 3 })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '졸업 멤버', level: 3 })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '태그 없는 멤버', level: 3 })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '초기화' }));
  fireEvent.click(within(filter).getByRole('button', { name: 'Python' }));
  expect(screen.queryByRole('heading', { name: '현재 멤버', level: 3 })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '졸업 멤버', level: 3 })).toBeInTheDocument();
});
