import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PublicPageHero from '../components/public/PublicPageHero';
import TagMultiSelect from '../components/public/TagMultiSelect';
import BackToListLink from '../components/public/BackToListLink';
import { resolveStudyRole, STUDY_ROLE } from '../utils/studyRoles';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

function TagFilterHarness() {
  const [selectedTags, setSelectedTags] = useState([]);
  const toggleTag = (tag) => {
    setSelectedTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((currentTag) => currentTag !== tag)
        : [...currentTags, tag]
    );
  };

  return (
    <TagMultiSelect
      tags={['React', 'Python']}
      selectedTags={selectedTags}
      onToggle={toggleTag}
      onReset={() => setSelectedTags([])}
      getTagClassName={() => 'tag-blue'}
      ariaLabel="기술 태그 필터"
    />
  );
}

describe('post-launch 공통 공개 UI', () => {
  test('공개 페이지 Hero가 공통 구조로 콘텐츠와 액션을 렌더링한다', () => {
    render(
      <PublicPageHero
        icon={<span>icon</span>}
        title="TCP Members"
        lead="TCP의 멤버들을 만나보세요."
        description="검색과 필터 기능으로 원하는 멤버를 찾아볼 수 있어요."
        action={<button type="button">시작하기</button>}
      />
    );

    expect(screen.getByRole('heading', { name: 'TCP Members' })).toBeInTheDocument();
    expect(screen.getByText('TCP의 멤버들을 만나보세요.')).toHaveClass('site-hero-lead');
    expect(screen.getByText('검색과 필터 기능으로 원하는 멤버를 찾아볼 수 있어요.')).toHaveClass('site-hero-description');
    expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument();
  });

  test('태그 필터는 복수 선택, 개별 해제, 전체 초기화를 지원한다', () => {
    render(<TagFilterHarness />);

    const reactTag = screen.getByRole('button', { name: 'React' });
    const pythonTag = screen.getByRole('button', { name: 'Python' });

    fireEvent.click(reactTag);
    fireEvent.click(pythonTag);
    expect(screen.getByText('2개 선택')).toBeInTheDocument();
    expect(reactTag).toHaveAttribute('aria-pressed', 'true');
    expect(pythonTag).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(reactTag);
    expect(screen.getByText('1개 선택')).toBeInTheDocument();
    expect(reactTag).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    expect(screen.queryByText(/개 선택/)).not.toBeInTheDocument();
    expect(pythonTag).toHaveAttribute('aria-pressed', 'false');
  });

  test('목록 이동 링크는 공통 텍스트 링크로 목적지를 유지한다', () => {
    render(
      <BackToListLink to="/study">스터디 목록으로 돌아가기</BackToListLink>
    );

    const link = screen.getByRole('link', { name: '스터디 목록으로 돌아가기' });
    expect(link).toHaveAttribute('href', '/study');
    expect(link).toHaveClass('public-back-to-list-link');
  });
});

describe('스터디 사용자 역할', () => {
  const currentUser = { id: 7, role: 'MEMBER' };

  test.each([
    ['리더', { leader: { user_id: 7 }, members: [] }, STUDY_ROLE.LEADER],
    ['리더 후보', { members: [{ user_id: 7, role: 'NOMINEE' }] }, STUDY_ROLE.NOMINEE],
    ['멤버', { members: [{ user_id: 7, role: 'MEMBER' }] }, STUDY_ROLE.MEMBER],
    ['승인 대기', { members: [{ user_id: 7, role: 'PENDING' }] }, STUDY_ROLE.PENDING],
    ['비참여자', { members: [] }, STUDY_ROLE.GUEST],
  ])('%s 역할을 하나의 값으로 판별한다', (_, study, expectedRole) => {
    expect(resolveStudyRole(study, currentUser)).toBe(expectedRole);
  });
});
