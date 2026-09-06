import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { apiGet } from '../api/client';
import Team from './Team';

jest.mock('../api/client', () => ({ apiGet: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../hooks/useScrollReveal', () => ({ useScrollReveal: jest.fn() }));
jest.mock('../components/modals/RecruitTeamModal', () => () => null);
jest.mock('../components/modals/TeamDetailModal', () => () => null);
jest.mock('../components/TeamCard', () => ({ team }) => <h3>{team.title}</h3>);

test('실제 팀 태그와 기술 스택을 후보로 제공하며 복합 태그를 보존한다', async () => {
  apiGet.mockResolvedValue([
    { id: 1, title: 'AI 팀', tag: ' #AI/ML, 새 태그 ', techStack: 'React Native, AI/ML', status: 'open' },
    { id: 2, title: '서버 팀', tag: '서버', techStack: 'Rust', status: 'open' },
  ]);
  render(<Team />);
  const ai = await screen.findByRole('button', { name: 'AI/ML' });
  const filter = screen.getByLabelText('팀 모집 태그 필터');
  expect(within(filter).getAllByRole('button')).toHaveLength(5);
  expect(within(filter).getByRole('button', { name: 'React Native' })).toBeInTheDocument();
  expect(within(filter).queryByRole('button', { name: '해커톤' })).not.toBeInTheDocument();
  fireEvent.click(ai);
  expect(screen.getByRole('heading', { name: 'AI 팀' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '서버 팀' })).not.toBeInTheDocument();
});
