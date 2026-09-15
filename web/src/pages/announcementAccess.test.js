import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import RequireRole from '../components/auth/RequireRole';
import { AuthProvider } from '../context/AuthContext';

jest.mock(
  'react-router-dom',
  () => ({
    Link: ({ to, children, ...props }) => (
      <a href={String(to)} {...props}>
        {children}
      </a>
    ),
    Navigate: ({ to }) => <div data-testid="redirect">{String(to)}</div>,
    useLocation: () => ({ pathname: '/announcement/write' }),
  }),
  { virtual: true },
);

const WEB_SRC = path.join(__dirname, '..');
const API_SRC = path.join(__dirname, '..', '..', '..', 'api', 'src');
const read = (p) => fs.readFileSync(path.join(WEB_SRC, p), 'utf8');
const readApi = (p) => fs.readFileSync(path.join(API_SRC, p), 'utf8');

const setUser = (user) => {
  localStorage.clear();
  if (user) {
    localStorage.setItem('access_token', 'token');
    localStorage.setItem('auth_user', JSON.stringify(user));
  }
};

describe('공지 작성 권한', () => {
  afterEach(() => localStorage.clear());

  it('서버가 공지 작성·수정·삭제를 ADMIN 으로 제한한다', () => {
    const controller = readApi('announcement/announcement.controller.ts');

    ['@Post()', "@Patch(':id')", "@Delete(':id')"].forEach((route) => {
      const index = controller.indexOf(route);
      expect(index).toBeGreaterThan(-1);
      const block = controller.slice(index, index + 200);
      expect(block).toContain('@UseGuards(JwtAuthGuard, RolesGuard)');
      expect(block).toContain('@Roles(UserRole.ADMIN)');
    });
  });

  it('작성·수정 화면 라우트를 ADMIN 으로 감싼다', () => {
    const app = read('App.js');

    ['/announcement/write', '/announcement/edit/:id'].forEach((route) => {
      const index = app.indexOf(`path="${route}"`);
      expect(index).toBeGreaterThan(-1);
      const block = app.slice(index, index + 220);
      expect(block).toContain('<RequireRole roles={["ADMIN"]}>');
      expect(block).toContain('<AnnouncementWrite />');
    });
  });

  it('글쓰기 버튼은 관리자에게만 보인다', () => {
    const source = read('pages/Announcement.jsx');

    expect(source).toContain("const canWrite = user?.role === 'ADMIN'");
    const index = source.indexOf('글쓰기');
    expect(source.slice(0, index)).toContain('{canWrite && (');
  });
});

describe('RequireRole', () => {
  const Secret = () => <p>작성 화면</p>;

  const renderWith = (user) => {
    setUser(user);
    return render(
      <AuthProvider>
        <RequireRole roles={['ADMIN']}>
          <Secret />
        </RequireRole>
      </AuthProvider>,
    );
  };

  afterEach(() => localStorage.clear());

  it('비로그인 사용자는 로그인 화면으로 보낸다', () => {
    renderWith(null);

    expect(screen.getByTestId('redirect')).toHaveTextContent('/login');
    expect(screen.queryByText('작성 화면')).not.toBeInTheDocument();
  });

  it('일반 회원에게는 작성 화면 대신 안내를 보여준다', () => {
    renderWith({ id: 'u1', role: 'MEMBER' });

    expect(screen.getByText('접근 권한이 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('작성 화면')).not.toBeInTheDocument();
  });

  it('관리자에게만 화면을 보여준다', () => {
    renderWith({ id: 'u2', role: 'ADMIN' });

    expect(screen.getByText('작성 화면')).toBeInTheDocument();
  });
});
