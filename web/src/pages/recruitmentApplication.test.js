import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Recruitment from './Recruitment';
import { apiGet } from '../api/client';

jest.mock(
  'react-router-dom',
  () => ({
    Link: ({ to, children, ...props }) => (
      <a href={String(to)} {...props}>
        {children}
      </a>
    ),
  }),
  { virtual: true },
);

jest.mock('../api/client', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('모바일 지원서 팝업', () => {
  beforeEach(() => {
    window.IntersectionObserver = MockIntersectionObserver;
    window.confirm = jest.fn(() => true);
    apiGet.mockResolvedValue({
      is_application_enabled: true,
      start_date: '2026-08-01T00:00:00.000Z',
      end_date: '2026-09-30T23:59:59.999Z',
    });
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  test('지원 버튼을 누르면 접근 가능한 전체 화면형 지원서가 열린다', async () => {
    const { container } = render(<Recruitment />);

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: '지금 지원하기' })).not.toHaveLength(0),
    );
    const applyButtons = screen.getAllByRole('button', { name: '지금 지원하기' });
    applyButtons.forEach((button) => expect(button).toHaveClass('primary-cta-text'));
    fireEvent.click(applyButtons[0]);

    const dialog = screen.getByRole('dialog', { name: 'TCP 지원서' });
    expect(dialog).toHaveClass('recruitment-application-sheet');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(container.querySelector('.recruitment-application-scroll')).not.toBeNull();
    expect(container.querySelector('.recruitment-application-footer')).not.toBeNull();
    expect(screen.getByRole('button', { name: '지원서 닫기' })).toBeInTheDocument();
    expect(screen.queryByText('TCP RECRUITMENT')).not.toBeInTheDocument();
    expect(container.querySelector('.project-date-range').querySelectorAll('input')).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: '프로젝트 1 시작일' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '프로젝트 1 종료일' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('빈 지원서는 경고 없이 취소할 수 있고 페이지 스크롤을 복원한다', async () => {
    render(<Recruitment />);

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: '지금 지원하기' })).not.toHaveLength(0),
    );
    fireEvent.click(screen.getAllByRole('button', { name: '지금 지원하기' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'TCP 지원서' })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  test('390px 화면에서는 전체 높이 시트와 독립 스크롤·고정 동작 영역을 사용한다', () => {
    const css = fs.readFileSync(
      path.join(__dirname, '..', 'styles', 'recruitmentApplication.css'),
      'utf8',
    );

    expect(css).toMatch(
      /\.recruitment-application-scroll\s*{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s,
    );
    expect(css).toMatch(
      /\.recruitment-application-modal \.recruitment-application-sheet\s*{[^}]*overflow:\s*hidden;[^}]*overflow:\s*clip;/s,
    );
    expect(css).toMatch(
      /\.recruitment-application-footer\s*{[^}]*display:\s*grid;[^}]*safe-area-inset-bottom/s,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*479px\)[\s\S]*\.recruitment-application-modal \.recruitment-application-sheet\s*{[^}]*height:\s*100dvh;[^}]*border-radius:\s*0;/s,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*479px\)[\s\S]*\.recruitment-application-scroll \.form-input,[\s\S]*font-size:\s*16px;/s,
    );
    expect(css).toMatch(
      /\.recruitment-application-scroll \.form-input,[\s\S]*?min-height:\s*44px;[^}]*padding:\s*9px 12px;/s,
    );
    expect(css).toMatch(
      /\.recruitment-application-scroll \.entry-field\s*{[^}]*margin-top:\s*17px;/s,
    );
    expect(css).toMatch(
      /\.recruitment-application-scroll \.entry-add-button\s*{[^}]*width:\s*100%;[^}]*justify-content:\s*center;/s,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*479px\)[\s\S]*\.recruitment-application-scroll \.project-date-range\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\);/s,
    );
  });
});
