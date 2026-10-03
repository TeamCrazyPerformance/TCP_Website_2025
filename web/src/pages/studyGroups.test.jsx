import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { apiGet } from '../api/client';
import Study from './Study';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock('../api/client', () => ({ apiGet: jest.fn() }));
jest.mock('../hooks/useScrollReveal', () => ({ useScrollReveal: jest.fn() }));
jest.mock('../components/modals/RecruitStudyModal', () => ({ isOpen, onAddStudy }) => (
  isOpen ? (
    <button onClick={() => onAddStudy({
      id: 99,
      title: '새 예정 스터디',
      year: new Date().getFullYear(),
      status: 'upcoming',
      period: '개설한 스터디의 기간',
      tags: ['스터디'],
    })}>
      예정 스터디 등록
    </button>
  ) : null
));

const year = new Date().getFullYear();
const study = (id, name, status, startYear = year) => ({
  id,
  study_name: name,
  start_year: startYear,
  period: `${startYear}.01.01 ~ ${startYear}.12.31`,
  status,
  is_public: false,
});

const renderStudy = () => render(<Study />);

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
});

it('비회원에게도 상태별로 목록을 나누고 연도 필터를 모든 영역에 적용한다', async () => {
  apiGet.mockResolvedValue([
    study(1, '현재 스터디', 'ongoing'),
    study(2, '예정 스터디', 'upcoming'),
    study(3, '종료 스터디', 'completed'),
    { ...study(4, '기간 없는 스터디', 'unknown'), period: null },
    study(5, '지난해 스터디', 'completed', year - 1),
  ]);
  renderStudy();

  const active = await screen.findByRole('region', { name: '예정·진행 중인 스터디' });
  await waitFor(() => expect(screen.getByLabelText('년도 선택')).toHaveValue(String(year)));
  const completed = screen.getByRole('region', { name: '종료된 스터디' });
  const unknown = screen.getByRole('region', { name: '기간 미확인 스터디' });

  expect(within(active).getAllByRole('link')).toHaveLength(2);
  expect(within(active).getByRole('link', { name: /현재 스터디/ })).toHaveAttribute('href', '/study/1');
  expect(within(active).getByRole('link', { name: /예정 스터디/ })).toHaveAttribute('href', '/study/2');
  expect(within(completed).getAllByRole('link')).toHaveLength(1);
  expect(within(completed).getByRole('link')).toHaveAttribute('href', '/study/3');
  expect(within(unknown).getByRole('link')).toHaveAttribute('href', '/study/4');
  expect(screen.queryByText('지난해 스터디')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('년도 선택'), { target: { value: String(year - 1) } });

  expect(screen.getByText('지난해 스터디')).toBeInTheDocument();
  expect(screen.queryByText('현재 스터디')).not.toBeInTheDocument();
  expect(screen.getByText('선택한 연도에 예정·진행 중인 스터디가 없습니다.')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '기간 미확인 스터디' })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('년도 선택'), { target: { value: 'all' } });

  expect(within(screen.getByRole('region', { name: '종료된 스터디' })).getAllByRole('link')).toHaveLength(2);
  expect(screen.getAllByRole('link')).toHaveLength(5);
});

it('진행 중인 스터디만 있어도 종료 영역과 빈 안내를 보여준다', async () => {
  apiGet.mockResolvedValue([study(1, '현재 스터디', 'ongoing')]);
  renderStudy();

  const completed = await screen.findByRole('region', { name: '종료된 스터디' });
  expect(within(completed).getByText('선택한 연도에 종료된 스터디가 없습니다.')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '기간 미확인 스터디' })).not.toBeInTheDocument();
});

it('스터디가 없거나 로딩에 실패했을 때 서로 다른 안내를 보여준다', async () => {
  apiGet.mockResolvedValueOnce([]);
  const { unmount } = renderStudy();

  expect(screen.getByRole('status')).toHaveTextContent('스터디 정보를 불러오는 중');
  expect(screen.queryByText('해당 년도에는 등록된 스터디가 없습니다.')).not.toBeInTheDocument();
  expect(await screen.findByText('해당 년도에는 등록된 스터디가 없습니다.')).toBeInTheDocument();
  unmount();

  apiGet.mockRejectedValueOnce(new Error('목록 조회 실패'));
  renderStudy();

  expect(await screen.findByRole('alert')).toHaveTextContent('목록 조회 실패');
  expect(screen.queryByText('해당 년도에는 등록된 스터디가 없습니다.')).not.toBeInTheDocument();
});

it('새로 개설한 스터디를 서버가 반환한 상태에 맞는 영역에 바로 추가한다', async () => {
  localStorage.setItem('auth_user', JSON.stringify({ id: 'member', role: 'MEMBER' }));
  apiGet.mockResolvedValue([study(1, '종료 스터디', 'completed')]);
  renderStudy();
  await screen.findByRole('region', { name: '종료된 스터디' });

  fireEvent.click(screen.getByRole('button', { name: '스터디 개설하기' }));
  fireEvent.click(screen.getByRole('button', { name: '예정 스터디 등록' }));

  const active = screen.getByRole('region', { name: '예정·진행 중인 스터디' });
  expect(within(active).getByRole('link')).toHaveAttribute('href', '/study/99');
  expect(within(screen.getByRole('region', { name: '종료된 스터디' })).getByRole('link')).toHaveAttribute('href', '/study/1');
});
