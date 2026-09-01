import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api/client';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import '../styles/studyDetail.css';
import BackToListLink from '../components/public/BackToListLink';
import { resolveStudyRole, STUDY_ROLE } from '../utils/studyRoles';

const md = new MarkdownIt({ html: true, linkify: true, breaks: true });
const normalizeBoolean = (value) => value === true || value === 1 || value === '1' || value === 'true';

const getStoredUser = () => {
  const storedUser = localStorage.getItem('auth_user');
  return storedUser ? JSON.parse(storedUser) : null;
};

const mapStudy = (data) => ({
  id: data.id,
  year: data.start_year,
  title: data.study_name,
  period: data.period || `${data.start_year}년`,
  method: data.way || '정보 없음',
  cycle: data.cycle || '정보 없음',
  location: data.place || '정보 없음',
  recruitCount: data.recruit_count || 0,
  memberCount: (data.members || []).filter((member) =>
    ['MEMBER', 'LEADER', 'NOMINEE'].includes(member.role)
  ).length,
  description: data.study_description,
  tags: data.tag ? data.tag.split(',').map((tag) => tag.trim()) : ['스터디'],
  isPublic: normalizeBoolean(data.is_public),
  leader: data.leader ? {
    id: data.leader.user_id,
    name: data.leader.name || '알 수 없음',
    quote: data.leader.intro || '함께 성장하는 스터디를 만들어갑시다!',
  } : null,
});

const mapMembers = (data) => (data.members || [])
  .filter((member) => ['MEMBER', 'LEADER', 'NOMINEE'].includes(member.role))
  .map((member) => ({
    id: member.user_id,
    name: member.user?.name || member.name,
    role: member.role === 'LEADER'
      ? '스터디장'
      : member.role === 'NOMINEE' ? '스터디장 후보' : '스터디원',
    avatar: member.user?.profile_image || member.profile_image || 'https://via.placeholder.com/40',
    major: member.user?.major || '전공 미입력',
    techStack: member.user?.tech_stack || [],
  }));

function StudyActionBar({
  studyId,
  role,
  isAdmin,
  canJoin,
  onJoin,
  onAcceptLeadership,
  onDeclineLeadership,
}) {
  return (
    <div className="study-detail-actions">
      {(role === STUDY_ROLE.LEADER || isAdmin) && (
        <Link to={`/study/${studyId}/manage`} className="study-detail-action cta-button primary-cta-text">
          <i className="fas fa-cog mr-2" aria-hidden="true"></i>
          스터디 관리
        </Link>
      )}

      {role === STUDY_ROLE.NOMINEE && (
        <>
          <button
            type="button"
            onClick={onAcceptLeadership}
            className="study-detail-action study-detail-action-warning"
          >
            <i className="fas fa-crown mr-2" aria-hidden="true"></i>
            스터디장 수락
          </button>
          <button
            type="button"
            onClick={onDeclineLeadership}
            className="study-detail-action study-detail-action-secondary"
          >
            거절
          </button>
        </>
      )}

      {canJoin && (
        <button
          type="button"
          onClick={onJoin}
          className="study-detail-action cta-button primary-cta-text"
        >
          <i className="fas fa-user-plus mr-2" aria-hidden="true"></i>
          스터디 참여
        </button>
      )}
    </div>
  );
}

export default function StudyDetail() {
  const { id } = useParams();
  const [study, setStudy] = useState(null);
  const [members, setMembers] = useState([]);
  const [progress, setProgress] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [userRole, setUserRole] = useState(STUDY_ROLE.GUEST);

  const [selectedProgress, setSelectedProgress] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');

  const currentUser = getStoredUser();

  const loadStudy = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    const storedUser = getStoredUser();

    if (!token) {
      setIsLoading(false);
      setStudy(null);
      setMembers([]);
      setProgress([]);
      setUserRole(STUDY_ROLE.GUEST);
      setErrorMessage('스터디 상세는 로그인 후 확인할 수 있습니다.');
      return;
    }

    try {
      setIsLoading(true);
      const data = await apiGet(`/api/v1/study/${id}`);
      const role = resolveStudyRole(data, storedUser);
      const canViewMemberContent = [
        STUDY_ROLE.MEMBER,
        STUDY_ROLE.NOMINEE,
        STUDY_ROLE.LEADER,
      ].includes(role) || storedUser?.role === 'ADMIN';

      setStudy(mapStudy(data));
      setMembers(mapMembers(data));
      setUserRole(role);
      setErrorMessage('');

      if (canViewMemberContent) {
        try {
          const progressData = await apiGet(`/api/v1/study/${id}/progress`);
          setProgress(progressData || []);
        } catch {
          setProgress([]);
        }
      } else {
        setProgress([]);
      }
    } catch (error) {
      setStudy(null);
      setMembers([]);
      setProgress([]);
      setUserRole(STUDY_ROLE.GUEST);
      setErrorMessage(error.message || '스터디 정보를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadStudy();
  }, [loadStudy]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const term = memberSearch.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(term) ||
      m.role.toLowerCase().includes(term) ||
      (m.major && m.major.toLowerCase().includes(term))
    );
  }, [members, memberSearch]);


  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        스터디 정보를 불러오는 중...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <main className="study-detail-page">
        <div className="study-detail-shell container mx-auto px-4 max-w-4xl">
          <nav
            className="detail-breadcrumb detail-breadcrumb-spaced study-detail-breadcrumb"
            aria-label="현재 위치"
          >
            <BackToListLink to="/study">
              스터디 목록으로 돌아가기
            </BackToListLink>
          </nav>
          <div className="study-detail-empty-state">{errorMessage}</div>
        </div>
      </main>
    );
  }

  if (!study) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        스터디 정보를 찾을 수 없습니다.
      </div>
    );
  }

  const handleJoin = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('로그인 후 신청할 수 있습니다.');
      return;
    }
    try {
      await apiPost(`/api/v1/study/${id}/apply`, {});
      alert('스터디 가입 신청이 완료되었습니다. 스터디장의 승인을 기다려주세요.');
      await loadStudy();
    } catch (error) {
      alert(error.message || '가입 신청에 실패했습니다.');
    }
  };

  const handleAcceptLeadership = async () => {
    if (!window.confirm('스터디장 지명을 수락하시겠습니까?')) return;
    try {
      await apiPost(`/api/v1/study/${id}/accept-leadership`);
      alert('스터디장 지명을 수락했습니다. 이제 스터디장입니다!');
      await loadStudy();
    } catch (error) {
      alert(error.message || '수락에 실패했습니다.');
    }
  };

  const handleDeclineLeadership = async () => {
    if (!window.confirm('스터디장 지명을 거절하시겠습니까?')) return;
    try {
      await apiPost(`/api/v1/study/${id}/decline-leadership`);
      alert('스터디장 지명을 거절했습니다.');
      await loadStudy();
    } catch (error) {
      alert(error.message || '거절에 실패했습니다.');
    }
  };

  const handleDownload = async (resourceId, fileName) => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/study/${id}/resources/${resourceId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('다운로드 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert(error.message || '다운로드에 실패했습니다.');
    }
  };

  const handleDeleteProgress = async (progressId) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      await apiDelete(`/api/v1/study/${id}/progress/${progressId}`);
      await loadStudy();
    } catch (error) {
      alert(error.message || '진행사항 삭제에 실패했습니다.');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('이 스터디원을 내보내시겠습니까?')) return;

    try {
      await apiDelete(`/api/v1/study/${id}/members/${memberId}`);
      alert('스터디원을 내보냈습니다.');
      await loadStudy();
    } catch (error) {
      alert(error.message || '스터디원을 내보내지 못했습니다.');
    }
  };

  const isAdmin = currentUser?.role === 'ADMIN';
  const canManage = userRole === STUDY_ROLE.LEADER || isAdmin;
  const canViewMemberContent = [
    STUDY_ROLE.MEMBER,
    STUDY_ROLE.NOMINEE,
    STUDY_ROLE.LEADER,
  ].includes(userRole) || isAdmin;
  const canJoin = userRole === STUDY_ROLE.GUEST
    && (study.isPublic || (currentUser && currentUser.role !== 'GUEST'));

  return (
    <main className="study-detail-page">
      <div className="study-detail-shell container mx-auto px-4 max-w-4xl">
      {/* Back Navigation */}
      <nav
        className="detail-breadcrumb detail-breadcrumb-spaced study-detail-breadcrumb"
        aria-label="현재 위치"
      >
        <BackToListLink to="/study">
          스터디 목록으로 돌아가기
        </BackToListLink>
      </nav>

      {/* Study Overview */}
      <section className="study-detail-overview scroll-fade visible">
        <div className="study-detail-surface">
          {/* Title Area */}
          <div className="study-detail-header">

            <div className="study-detail-heading">
              <div className="study-detail-title-row">
                <h1 className="study-detail-title">
                  {study.title}
                </h1>
                {study.isPublic && (
                  <span className="study-detail-visibility">
                    <i className="fas fa-unlock-alt mr-2"></i>
                    공개 스터디
                  </span>
                )}
              </div>
              <p className="study-detail-description whitespace-pre-wrap">{study.description}</p>
              <div className="study-detail-tags">
                {study.tags.map((tag, index) => {
                  const colors = ['tag-blue', 'tag-purple', 'tag-green', 'tag-yellow', 'tag-red'];
                  const colorClass = colors[index % colors.length];
                  return (
                    <span key={tag} className={`tag ${colorClass}`}>
                      {tag}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="study-detail-action-wrap">
              <StudyActionBar
                studyId={id}
                role={userRole}
                isAdmin={isAdmin}
                canJoin={canJoin}
                onJoin={handleJoin}
                onAcceptLeadership={handleAcceptLeadership}
                onDeclineLeadership={handleDeclineLeadership}
              />
            </div>
          </div>

          {/* Info Grid */}
          <div className="study-detail-info-grid">
            <div className="study-detail-info-card">
              <h3><i className="fas fa-calendar-alt" aria-hidden="true"></i>진행 기간</h3>
              <p>{study.period}</p>
            </div>
            <div className="study-detail-info-card">
              <h3><i className="fas fa-laptop-code" aria-hidden="true"></i>진행 방식</h3>
              <p>{study.method}</p>
            </div>
            <div className="study-detail-info-card">
              <h3><i className="fas fa-sync-alt" aria-hidden="true"></i>주기</h3>
              <p>{study.cycle}</p>
            </div>
            <div className="study-detail-info-card">
              <h3><i className="fas fa-map-marker-alt" aria-hidden="true"></i>장소</h3>
              <p>{study.location}</p>
            </div>
            <div className="study-detail-info-card">
              <h3><i className="fas fa-user" aria-hidden="true"></i>스터디장</h3>
              <p>
                <strong>{study.leader ? study.leader.name : '공석'}</strong>
                {study.leader && <span>"{study.leader.quote}"</span>}
              </p>
            </div>
            <div className="study-detail-info-card">
              <h3><i className="fas fa-users" aria-hidden="true"></i>참여 인원</h3>
              <p>
                <strong>{study.memberCount}</strong>명 / {study.recruitCount}명
                {study.memberCount >= study.recruitCount ? ' (모집 완료)' : ' (모집 중)'}
              </p>
            </div>
          </div>


        </div>
      </section>

      {/* Weekly Progress Section */}
      {
        canViewMemberContent && (
          <section className="study-detail-section scroll-fade visible">
            <div className="study-detail-section-heading">
              <h2 className="study-detail-section-title"><i className="fas fa-book-open" aria-hidden="true"></i>주차별 진행 현황</h2>
              {canManage && (
                <Link
                  to={`/study/${id}/progress/write`}
                  className="cta-button px-4 py-2 rounded-lg font-bold text-white hover:text-black transition-colors inline-flex items-center"
                >
                  <i className="fas fa-plus mr-2"></i> 새 글 작성
                </Link>
              )}
            </div>

            {/* Weeks Grid */}
            {progress.length > 0 ? (
              <div className="study-detail-week-grid">
                {progress.map((item) => (
                  <div key={item.id} className="week-card study-detail-week-card relative group" onClick={() => setSelectedProgress(item)}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="tag tag-blue text-xs">Week {item.weekNo || '?'}</span>
                      <span className="text-sm text-gray-400">
                        {item.progressDate ? new Date(item.progressDate).toISOString().split('T')[0].replace(/-/g, '.') : ''}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold mb-2 text-white line-clamp-2">{item.title}</h3>

                    {/* Content Preview - strip HTML tags if needed or just show substring */}
                    <div className="text-sm text-gray-400 mb-3 line-clamp-3">
                      {item.content.replace(/<[^>]*>?/gm, '')}
                    </div>

                    {/* Hover Content / Actions */}
                    <div className="hover-content absolute inset-x-0 bottom-0 p-6 bg-gray-800/90 backdrop-blur-sm rounded-b-xl border-t border-gray-700">
                      {canManage ? (
                        <div className="flex justify-between items-center">
                          <div className="flex gap-2">
                            <Link
                              to={`/study/${id}/progress/${item.id}/edit`}
                              className="text-xs px-3 py-1 rounded border border-gray-500 hover:border-white text-gray-300 hover:text-white transition-colors"
                            >
                              <i className="fas fa-pen mr-1"></i>편집
                            </Link>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteProgress(item.id);
                              }}
                              className="text-xs px-3 py-1 rounded border border-red-900 hover:border-red-500 text-red-400 hover:text-red-300 transition-colors"
                            >
                              <i className="fas fa-trash mr-1"></i>삭제
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-300">클릭하여 자세히 보기</p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {item.resources && item.resources.length > 0 && (
                          <>
                            <i className="fas fa-paperclip text-blue-400"></i>
                            <span className="text-xs text-gray-400">{item.resources.length}개 첨부</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="study-detail-empty-state">
                <i className="fas fa-book-open text-4xl text-gray-600 mb-4"></i>
                <p className="text-gray-400">아직 등록된 진행사항이 없습니다.</p>
              </div>
            )}
          </section>
        )
      }

      {/* Member Search / List Section */}
      {
        canViewMemberContent && (
          <section className="study-detail-section scroll-fade visible">
            <h2 className="study-detail-section-title"><i className="fas fa-users" aria-hidden="true"></i>스터디원 검색</h2>
            <div className="study-detail-member-surface">
              {/* Search Input */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="search-input w-full px-4 py-3 rounded-lg text-white placeholder-gray-400"
                    placeholder="이름, 역할, 전공으로 검색..."
                  />
                </div>
                <button className="cta-button px-6 py-3 rounded-lg font-bold text-white hover:text-black transition-colors flex items-center justify-center shrink-0">
                  <i className="fas fa-search mr-2"></i> 검색
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMembers.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    <i className="fas fa-user-slash text-4xl mb-4 block"></i>
                    <p className="text-lg">검색 결과가 없습니다.</p>
                  </div>
                )}
                {filteredMembers.map(member => (
                  <div key={member.id} className="study-detail-member-card">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold overflow-hidden">
                        {member.avatar && member.avatar !== 'https://via.placeholder.com/40' ? (
                          <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{member.name.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-white">{member.name}</h4>
                        <p className="text-sm text-gray-400">{member.role}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {member.major || '전공 미입력'} {member.studentNumber ? `${member.studentNumber}학번` : ''}
                    </div>
                    <p className="text-sm text-gray-300 mb-3">
                      {member.bio || `안녕하세요, ${member.name}입니다.`}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <span className="tag tag-devops text-xs">{member.role || 'MEMBER'}</span>
                    </div>

                    {canManage && member.id !== currentUser?.id && (
                      <div className="flex justify-end mt-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-xs px-3 py-1 rounded border border-red-800 hover:border-red-500 text-red-400 hover:text-red-300 transition-colors"
                        >
                          내보내기
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      }

      {/* Article Modal */}
      {selectedProgress && (
        <div
          className="modal active"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedProgress(null); }}
        >
          <div className="modal-content" style={{ overflowY: 'auto' }}>
            <button
              onClick={() => setSelectedProgress(null)}
              className="close-modal"
            >
              <i className="fas fa-times"></i>
            </button>

            <article>
              <header className="mb-6">
                <div className="mb-4">
                  <span className="tag tag-blue px-3 py-1 rounded-full text-xs">
                    Week {selectedProgress.weekNo || '?'}
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold mb-4 gradient-text">
                  {selectedProgress.title}
                </h1>

                <div className="article-meta rounded-lg p-4 mb-6">
                  <div className="flex flex-wrap items-center justify-between text-sm text-gray-300">
                    <div className="flex items-center space-x-4 mb-2 md:mb-0">
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-user text-blue-400"></i>
                        <span>스터디장: {study.leader ? study.leader.name : '알 수 없음'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-calendar text-purple-400"></i>
                        <span>
                          {selectedProgress.progressDate
                            ? new Date(selectedProgress.progressDate).toISOString().split('T')[0].replace(/-/g, '.')
                            : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </header>

              <div className="article-content rounded-lg p-6 mb-6">
                <div
                  className="article-body text-gray-200 text-left"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(md.render(selectedProgress.content || '')),
                  }}
                />
              </div>

              {/* Attachments */}
              {selectedProgress.resources && selectedProgress.resources.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-bold text-white mb-4">📎 첨부 파일</h3>
                  <div className="space-y-3">
                    {selectedProgress.resources.map((resource) => (
                      <button
                        key={resource.id}
                        onClick={() => handleDownload(resource.id, resource.name)}
                        className="attachment-item flex items-center space-x-3 p-3 rounded-lg w-full text-left"
                      >
                        <i className={`fas ${resource.format === 'pdf' ? 'fa-file-pdf text-red-400'
                          : resource.format === 'docx' ? 'fa-file-word text-blue-400'
                          : resource.format === 'pptx' ? 'fa-file-powerpoint text-orange-400'
                          : resource.format === 'md' ? 'fa-file-code text-green-400'
                            : 'fa-file text-gray-400'
                          } text-lg`}></i>
                        <div className="flex-1">
                          <p className="font-medium text-white">{resource.name}</p>
                          <p className="text-sm text-gray-400 uppercase">{resource.format}</p>
                        </div>
                        <i className="fas fa-download text-gray-400"></i>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </article>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
