import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api/client';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import defaultProfileImage from '../logo.svg';

const md = new MarkdownIt({ html: true, linkify: true, breaks: true });

export default function StudyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [study, setStudy] = useState(null);
  const [members, setMembers] = useState([]);
  const [progress, setProgress] = useState([]);
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // userRole is dynamically determined based on API response
  const [userRole, setUserRole] = useState('guest'); // 'guest', 'member', 'leader'

  // Progress form state
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [progressTitle, setProgressTitle] = useState('');
  const [progressContent, setProgressContent] = useState('');
  const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);
  const [selectedProgress, setSelectedProgress] = useState(null); // For Modal

  // Member search state
  const [memberSearch, setMemberSearch] = useState('');

  // Resource upload state
  const fileInputRef = useRef(null);
  const [isUploadingResource, setIsUploadingResource] = useState(false);

  const user = localStorage.getItem('auth_user');
  const currentUser = user ? JSON.parse(user) : null;

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('auth_user');
    const currentUser = user ? JSON.parse(user) : null;

    if (!token) {
      setIsLoading(false);
      setErrorMessage('스터디 상세는 로그인 후 확인할 수 있습니다.');
      return undefined;
    }

    const fetchStudy = async () => {
      try {
        setIsLoading(true);
        const data = await apiGet(`/api/v1/study/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Determine user role based on API response
        // PENDING users are still treated as guests until approved
        let role = 'guest';
        if (currentUser?.id) {
          // Check explicitly against the leader object first (safest)
          if (data.leader?.user_id === currentUser.id) {
            role = 'leader';
          }
          // Check members array
          else if (data.members?.some((m) => m.user_id === currentUser.id && m.role === 'LEADER')) {
            role = 'leader';
          } else if (data.members?.some((m) => m.user_id === currentUser.id && m.role === 'MEMBER')) {
            role = 'member';
          }
        }

        const mappedStudy = {
          id: data.id,
          year: data.start_year,
          title: data.study_name,
          period: data.period || `${data.start_year}년`,
          method: data.way || '정보 없음',
          location: data.place || '정보 없음',
          recruitCount: data.recruit_count || 0,
          recruitCount: data.recruit_count || 0,
          memberCount: (data.members || []).filter(m => m.role === 'MEMBER' || m.role === 'LEADER').length,
          description: data.study_description,
          tags: data.tag ? data.tag.split(',').map((t) => t.trim()) : ['스터디'],
          leader: data.leader ? {
            id: data.leader.user_id,
            name: data.leader.name || '알 수 없음',
            quote: data.leader.intro || '함께 성장하는 스터디를 만들어갑시다!',
          } : null,
        };
        // Filter out PENDING members, show MEMBER and LEADER
        const approvedMembers = (data.members || []).filter(m => m.role === 'MEMBER' || m.role === 'LEADER');
        const mappedMembers = approvedMembers.map((member) => ({
          id: member.user_id,
          name: member.user?.name || member.name,
          role: member.role === 'LEADER' ? '스터디장' : '스터디원',
          avatar: member.user?.profile_image || member.profile_image || null,
          major: member.user?.major || member.major || '전공 미입력',
          bio: member.user?.self_description || member.self_description || '',
        }));

        if (isMounted) {
          setStudy(mappedStudy);
          setMembers(mappedMembers);
          setUserRole(role);
          setErrorMessage('');

          // For members/leaders/admins: fetch rich progress data from dedicated endpoint
          // For guests: use the basic progress included in the study response
          if (role !== 'guest') {
            try {
              const progressData = await apiGet(`/api/v1/study/${id}/progress`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              setProgress(progressData || []);
            } catch {
              setProgress(data.progress || []);
            }

            // Fetch resources (members/leaders only)
            try {
              const resourceData = await apiGet(`/api/v1/study/${id}/resources`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              setResources(resourceData || []);
            } catch {
              setResources([]);
            }
          } else {
            // Guests use inline progress from study detail response
            setProgress(data.progress || []);
          }
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || '스터디 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchStudy();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Filtered members for search (must be before early returns per Rules of Hooks)
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
      <div className="container mx-auto px-4 py-24 text-center text-gray-400">
        <p className="mb-6">{errorMessage}</p>
        <Link
          to="/study"
          className="back-button inline-flex items-center px-8 py-4 rounded-lg text-lg font-medium"
        >
          <i className="fas fa-list mr-3"></i>
          스터디 목록 보기
        </Link>
      </div>
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
      await apiPost(`/api/v1/study/${id}/apply`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert('스터디 가입 신청이 완료되었습니다. 스터디장의 승인을 기다려주세요.');
      window.location.reload();
    } catch (error) {
      alert(error.message || '가입 신청에 실패했습니다.');
    }
  };


  const handleProgressSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    if (!token) return;

    if (!progressTitle.trim() || !progressContent.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    try {
      setIsSubmittingProgress(true);
      await apiPost(`/api/v1/study/${id}/progress`, {
        title: progressTitle,
        content: progressContent,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert('진행사항이 등록되었습니다.');
      setProgressTitle('');
      setProgressContent('');
      setShowProgressForm(false);
      window.location.reload();
    } catch (error) {
      alert(error.message || '진행사항 등록에 실패했습니다.');
    } finally {
      setIsSubmittingProgress(false);
    }
  };

  const handleResourceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    // Check file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    const allowedExtensions = ['pdf', 'docx', 'pptx'];
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      alert('PDF, DOCX, PPTX 파일만 업로드 가능합니다.');
      return;
    }

    // Check file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }

    try {
      setIsUploadingResource(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/v1/study/${id}/resources`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '업로드 실패');
      }

      alert('자료가 업로드되었습니다.');
      window.location.reload();
    } catch (error) {
      alert(error.message || '자료 업로드에 실패했습니다.');
    } finally {
      setIsUploadingResource(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const ActionButtons = () => {
    const user = localStorage.getItem('auth_user');
    const currentUser = user ? JSON.parse(user) : null;
    const isAdmin = currentUser?.role === 'ADMIN';

    return (
      <div className="flex gap-2 items-center">
        {(userRole === 'leader' || isAdmin) && (
          <Link to={`/study/${id}/manage`} className="cta-button px-4 py-2 rounded-lg font-bold text-white hover:text-black transition-colors inline-flex items-center">
            <i className="fas fa-cog mr-2"></i>스터디 관리
          </Link>
        )}

        {/* Guest Join Button */}
        {(userRole === 'guest') && (
          <button
            onClick={handleJoin}
            className="cta-button px-6 py-3 rounded-lg font-bold text-white hover:text-black transition-colors flex items-center"
          >
            <i className="fas fa-user-plus mr-2"></i> 스터디 참여
          </button>
        )}
      </div>
    );
  };

  return (
    <main className="container mx-auto px-4 py-24 max-w-6xl">
      {/* Back Navigation */}
      <div className="mb-8">
        <Link to="/study" className="back-button inline-flex items-center px-6 py-3 rounded-lg text-sm font-medium">
          <i className="fas fa-arrow-left mr-2"></i>
          스터디 목록으로 돌아가기
        </Link>
      </div>

      {/* Study Overview */}
      <section className="mb-12 scroll-fade visible">
        <div className="feature-card rounded-xl p-8">
          {/* Title Area */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 via-blue-400 to-purple-400 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-network-wired text-white text-2xl"></i>
            </div>
            <div className="flex-1">
              <h1 className="orbitron text-3xl md:text-4xl font-bold gradient-text mb-2">
                {study.title}
              </h1>
              <p className="text-lg text-gray-300 mb-4">{study.description}</p>
              <div className="flex flex-wrap gap-2">
                {study.tags.map((tag, index) => {
                  // Simple logic to assign colors based on tag name or index
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
            <div className="ml-auto flex flex-col gap-2">
              <ActionButtons />
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-gray-300 text-left">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">📅 진행 기간</h3>
              <p>{study.period}</p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">📍 진행 방식</h3>
              <p>{study.method}</p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">🔄 주기</h3>
              <p>매주 1회 (협의 예정)</p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">🏢 장소</h3>
              <p>{study.location}</p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">👨‍💻 스터디장</h3>
              <p>
                <strong>{study.leader ? study.leader.name : '공석'}</strong>
                {study.leader && <span className="block text-sm text-gray-400">"{study.leader.quote}"</span>}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">👥 참여 인원</h3>
              <p>
                <span className="text-accent-blue font-bold">{study.memberCount}</span>명 / {study.recruitCount}명
                {study.memberCount >= study.recruitCount ? ' (모집 완료)' : ' (모집 중)'}
              </p>
            </div>
          </div>

          {/* Tech Stack (Derived from tags for now or static placeholder if not in DB) */}
          <div className="mt-6">
            <h3 className="text-lg font-bold text-white mb-3">🛠️ 기술 스택</h3>
            <p className="text-gray-300">
              {study.tags.join(', ')}
            </p>
          </div>
        </div>
      </section>

      {/* Weekly Progress Section — visible to all, but modal only for non-guests */}
      <section className="mb-12 scroll-fade visible">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold gradient-text">📚 주차별 진행 현황</h2>
          {(userRole === 'leader' || currentUser?.role === 'ADMIN') && (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {progress.map((item) => (
              <div key={item.id} className="week-card p-6 rounded-xl relative group" onClick={() => { if (userRole !== 'guest') setSelectedProgress(item); }} style={{ cursor: userRole === 'guest' ? 'default' : 'pointer' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="tag tag-blue text-xs">Week {item.weekNo || '?'}</span>
                  <span className="text-sm text-gray-400">
                    {item.progressDate ? new Date(item.progressDate).toISOString().split('T')[0].replace(/-/g, '.') : ''}
                  </span>
                </div>

                <h3 className="text-lg font-bold mb-2 text-white line-clamp-2">{item.title}</h3>

                {/* Content Preview */}
                <div className="text-sm text-gray-400 mb-3 line-clamp-3">
                  {item.content.replace(/<[^>]*>?/gm, '')}
                </div>

                {/* Hover Content / Actions — only for non-guests */}
                {userRole !== 'guest' && (
                  <div className="hover-content absolute inset-x-0 bottom-0 p-6 bg-gray-800/90 backdrop-blur-sm rounded-b-xl border-t border-gray-700">
                    {(userRole === 'leader' || currentUser?.role === 'ADMIN') ? (
                      <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                          <Link
                            to={`/study/${id}/progress/${item.id}/edit`}
                            className="text-xs px-3 py-1 rounded border border-gray-500 hover:border-white text-gray-300 hover:text-white transition-colors"
                          >
                            <i className="fas fa-pen mr-1"></i>편집
                          </Link>
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              if (!window.confirm('정말 삭제하시겠습니까?')) return;
                              try {
                                await apiDelete(`/api/v1/study/${id}/progress/${item.id}`);
                                window.location.reload();
                              } catch (err) { alert('삭제 실패'); }
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
                )}

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {item.resources && item.resources.length > 0 && (
                      <>
                        <i className="fas fa-paperclip text-blue-400"></i>
                        <span className="text-xs text-gray-400">{item.resources.length}개 첨부</span>
                      </>
                    )}
                  </div>
                  <span className="text-gray-500">→</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800 border-dashed">
            <i className="fas fa-book-open text-4xl text-gray-600 mb-4"></i>
            <p className="text-gray-400">아직 등록된 진행사항이 없습니다.</p>
          </div>
        )}
      </section>

      {/* General Resources Section */}
      {
        (userRole !== 'guest' || currentUser?.role === 'ADMIN') && (
          <section className="mb-12 scroll-fade visible">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold gradient-text">📂 공유 자료</h2>
              {(userRole === 'leader' || currentUser?.role === 'ADMIN') && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleResourceUpload}
                    accept=".pdf,.docx,.pptx"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingResource}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <i className="fas fa-upload mr-2"></i>
                    {isUploadingResource ? '업로드 중...' : '자료 업로드'}
                  </button>
                </>
              )}
            </div>
            {/* List layout for resources as per current simple design, or could be grid. Keeping list for file names. */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              {resources.length > 0 ? (
                <ul className="space-y-3">
                  {resources.map((resource) => (
                    <li key={resource.id} className="flex items-center justify-between bg-gray-800 p-4 rounded-lg hover:bg-gray-750 transition-colors">
                      <div className="flex items-center">
                        <i className={`fas ${resource.format === 'pdf' ? 'fa-file-pdf text-red-400' : resource.format === 'docx' ? 'fa-file-word text-blue-400' : 'fa-file-powerpoint text-orange-400'} text-2xl mr-4`}></i>
                        <div>
                          <p className="font-semibold text-white">{resource.name}</p>
                          <p className="text-sm text-gray-400 uppercase">{resource.format}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownload(resource.id, resource.name)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <i className="fas fa-download text-xl"></i>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-center">공유된 자료가 없습니다.</p>
              )}
            </div>
          </section>
        )
      }

      {/* Member Search / List Section — visible to all */}
      <section className="mb-12 scroll-fade visible">
        <h2 className="text-3xl font-bold gradient-text mb-8">👥 스터디원 검색</h2>
        <div className="feature-card rounded-xl p-8">
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
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                <i className="fas fa-user-slash text-4xl mb-4 block"></i>
                <p className="text-lg">검색 결과가 없습니다.</p>
              </div>
            )}
            {filteredMembers.map(member => (
              <div key={member.id} className="member-card p-4 rounded-lg">
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
                  {member.major || '전공 미입력'}
                </div>
                <p className="text-sm text-gray-300 mb-3">
                  {member.bio || `안녕하세요, ${member.name}입니다.`}
                </p>
                <div className="flex flex-wrap gap-1">
                  <span className="tag tag-devops text-xs">{member.role}</span>
                </div>

                {/* Kick button for Leader */}
                {(userRole === 'leader' || currentUser?.role === 'ADMIN') && member.id !== currentUser?.id && (
                  <div className="flex justify-end mt-3">
                    <button className="text-xs px-3 py-1 rounded border border-red-800 hover:border-red-500 text-red-400 hover:text-red-300 transition-colors">
                      <i className="fas fa-user-minus mr-1"></i>방출
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

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
    </main>
  );
}
