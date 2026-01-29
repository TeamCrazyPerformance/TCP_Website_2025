import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api/client';

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

  // Resource upload state
  const fileInputRef = useRef(null);
  const [isUploadingResource, setIsUploadingResource] = useState(false);

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
          if (data.leader?.user_id === currentUser.id) {
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
          // Count only MEMBER role (exclude PENDING)
          memberCount: (data.members || []).filter(m => m.role === 'MEMBER').length + (data.leader ? 1 : 0),
          description: data.study_description,
          tags: data.tag ? data.tag.split(',').map((t) => t.trim()) : ['스터디'],
        };
        // Filter out PENDING members, only show MEMBER role
        const approvedMembers = (data.members || []).filter(m => m.role === 'MEMBER');
        const mappedMembers = approvedMembers.map((member) => ({
          id: member.user_id,
          name: member.name,
          role: '스터디원',
          avatar: 'https://via.placeholder.com/40',
        }));
        // Add leader to the members list for display
        if (data.leader) {
          mappedMembers.unshift({
            id: data.leader.user_id,
            name: data.leader.name,
            role: '스터디장',
            avatar: 'https://via.placeholder.com/40',
          });
        }

        if (isMounted) {
          setStudy(mappedStudy);
          setMembers(mappedMembers);
          setUserRole(role);
          setErrorMessage('');

          // Fetch progress if user is member or leader
          if (role === 'member' || role === 'leader') {
            try {
              const progressData = await apiGet(`/api/v1/study/${id}/progress`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              setProgress(progressData || []);
            } catch {
              setProgress([]);
            }

            // Fetch resources
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

  const handleLeave = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    if (!window.confirm('정말로 스터디를 탈퇴하시겠습니까?')) return;
    try {
      await apiDelete(`/api/v1/study/${id}/leave`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert('스터디를 탈퇴했습니다.');
      navigate('/study');
    } catch (error) {
      alert(error.message || '탈퇴에 실패했습니다.');
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
    switch (userRole) {
      case 'leader':
        return (
          <div className="flex items-center gap-2">
            <Link to={`/study/${id}/manage`} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
              <i className="fas fa-cog mr-2"></i>스터디 관리
            </Link>
          </div>
        );
      case 'member':
        return (
          <button
            onClick={handleLeave}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            스터디 탈퇴하기
          </button>
        );
      case 'guest':
      default:
        return (
          <button
            onClick={handleJoin}
            className="cta-button text-white font-bold py-3 px-6 rounded-lg text-lg"
          >
            가입 신청하기
          </button>
        );
    }
  };

  return (
    <main className="container mx-auto px-4 py-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-accent-blue font-semibold">TCP {study.year} 스터디</p>
          <h1 className="orbitron text-4xl md:text-5xl font-bold gradient-text my-3">
            {study.title}
          </h1>
          <div className="flex flex-wrap gap-2 mt-4">
            {study.tags.map((tag) => (
              <span key={tag} className="tag-blue text-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Study Info & Action Buttons */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gray-900 border border-gray-800 rounded-xl p-6 mb-10">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-gray-300">
            <p>
              <strong className="text-white">기간:</strong> {study.period}
            </p>
            <p>
              <strong className="text-white">방식:</strong> {study.method}
            </p>
            <p>
              <strong className="text-white">현재 인원:</strong> {study.memberCount}명 / {study.recruitCount}명
            </p>
            <p>
              <strong className="text-white">장소:</strong> {study.location}
            </p>
          </div>
          <div className="w-full md:w-auto flex-shrink-0">
            <ActionButtons />
          </div>
        </div>

        {/* Main Content - visible to everyone */}
        <article className="prose prose-invert max-w-none bg-gray-900 border border-gray-800 rounded-xl p-8 mb-10">
          <h2 className="text-2xl font-bold text-white mb-4">스터디 소개</h2>
          <p>{study.description}</p>
        </article>

        {/* Progress Section - visible to members and leaders only */}
        {userRole !== 'guest' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">진행사항</h2>
              {userRole === 'leader' && (
                <button
                  onClick={() => setShowProgressForm(!showProgressForm)}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  <i className="fas fa-plus mr-2"></i>
                  {showProgressForm ? '취소' : '진행사항 작성'}
                </button>
              )}
            </div>

            {/* Progress Form - only for leaders */}
            {showProgressForm && userRole === 'leader' && (
              <form onSubmit={handleProgressSubmit} className="mb-6 bg-gray-800 p-6 rounded-lg">
                <div className="mb-4">
                  <label htmlFor="progressTitle" className="block text-sm font-semibold text-gray-100 mb-2">
                    제목
                  </label>
                  <input
                    type="text"
                    id="progressTitle"
                    value={progressTitle}
                    onChange={(e) => setProgressTitle(e.target.value)}
                    className="w-full bg-gray-700 border-gray-600 rounded-lg py-2 px-4 text-white focus:ring-2 focus:ring-accent-blue focus:outline-none"
                    placeholder="진행사항 제목"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="progressContent" className="block text-sm font-semibold text-gray-100 mb-2">
                    내용
                  </label>
                  <textarea
                    id="progressContent"
                    value={progressContent}
                    onChange={(e) => setProgressContent(e.target.value)}
                    rows="4"
                    className="w-full bg-gray-700 border-gray-600 rounded-lg py-2 px-4 text-white focus:ring-2 focus:ring-accent-blue focus:outline-none"
                    placeholder="진행사항 내용을 작성하세요"
                    required
                  ></textarea>
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingProgress}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmittingProgress ? '등록 중...' : '등록하기'}
                </button>
              </form>
            )}

            {/* Progress List */}
            {progress.length > 0 ? (
              <ul className="space-y-4">
                {progress.map((item) => (
                  <li key={item.id} className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="font-bold text-white text-lg mb-2">{item.title}</h3>
                    <p className="text-gray-300">{item.content}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-center py-4">아직 등록된 진행사항이 없습니다.</p>
            )}
          </div>
        )}

        {/* Resources Section - visible to members and leaders only */}
        {userRole !== 'guest' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">자료실</h2>
              {userRole === 'leader' && (
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
            <p className="text-sm text-gray-400 mb-4">PDF, DOCX, PPTX 파일만 업로드 가능 (최대 10MB)</p>

            {/* Resource List */}
            {resources.length > 0 ? (
              <ul className="space-y-3">
                {resources.map((resource) => (
                  <li key={resource.id} className="flex items-center justify-between bg-gray-800 p-4 rounded-lg">
                    <div className="flex items-center">
                      <i className={`fas ${resource.format === 'pdf' ? 'fa-file-pdf text-red-400' : resource.format === 'docx' ? 'fa-file-word text-blue-400' : 'fa-file-powerpoint text-orange-400'} text-2xl mr-4`}></i>
                      <div>
                        <p className="font-semibold text-white">{resource.name}</p>
                        <p className="text-sm text-gray-400 uppercase">{resource.format}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(resource.id, resource.name)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                      <i className="fas fa-download mr-2"></i>다운로드
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-center py-4">아직 업로드된 자료가 없습니다.</p>
            )}
          </div>
        )}

        {/* Member List - hidden for guests */}
        {userRole !== 'guest' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">참여중인 스터디원</h2>
            <ul className="space-y-4">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between bg-gray-800 p-4 rounded-lg"
                >
                  <div className="flex items-center">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-10 h-10 rounded-full mr-4"
                    />
                    <div>
                      <p className="font-bold text-white">{member.name}</p>
                      <p className="text-sm text-gray-400">{member.role}</p>
                    </div>
                  </div>
                  {userRole === 'leader' && member.role !== '스터디장' && (
                    <button className="text-sm text-red-500 hover:text-red-400">
                      내보내기
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
