import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiGet, apiPatch } from '../../api/client';
import {
  faLink,
  faCloudUploadAlt,
  faTimes,
  faCalendarAlt,
  faBook,
  faUsers,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

function Profile() {
  // 프로필 정보 상태 관리
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // 모달 관련 상태
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedPhotoSrc, setSelectedPhotoSrc] = useState('');
  const fileInputRef = useRef(null);

  // textarea 자동 높이 조절을 위한 ref
  const bioRef = useRef(null);

  // Team.jsx에서 가져온 태그 스타일 헬퍼 함수
  const getTagBgClass = (tag) => {
    switch (tag) {
      case 'JavaScript':
      case 'React':
      case 'Python':
      case 'C++':
      case 'Java':
      case 'Spring':
      case 'Next.js':
      case 'TypeScript':
      case 'Node.js':
      case 'MySQL':
      case 'MongoDB':
      case 'Flutter':
      case 'Swift':
      case 'Kotlin':
      case 'Unity':
      case 'C#':
      case 'CSS':
      case 'JPA':
      case 'AWS':
      case 'UI/UX':
      case 'Vue.js':
      case 'TailwindCSS':
        return 'bg-blue-900 text-blue-300';
      case '알고리즘':
      case '코딩테스트':
      case '심화':
        return 'bg-purple-900 text-purple-300';
      case 'DevOps':
      case '클라우드':
      case 'Kubernetes':
      case 'Docker':
      case 'CI/CD':
        return 'bg-green-900 text-green-300';
      case 'AI':
      case '머신러닝':
      case '생성형AI':
      case 'TensorFlow':
      case 'PyTorch':
      case 'Hugging Face':
        return 'bg-yellow-900 text-yellow-300';
      case '게임개발':
      case 'Game Dev':
        return 'bg-red-900 text-red-300';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  // 모든 사용 가능한 기술 스택 태그 목록
  const allTechTags = [
    'JavaScript',
    'React',
    'TypeScript',
    'Node.js',
    'Python',
    'C++',
    'Java',
    'Spring',
    'Next.js',
    'MySQL',
    'MongoDB',
    'Flutter',
    'Swift',
    'Kotlin',
    'Unity',
    'C#',
    'CSS',
    'TailwindCSS',
    'AI',
    'TensorFlow',
    'PyTorch',
    'Hugging Face',
    'DevOps',
    'Kubernetes',
    'Docker',
    'AWS',
  ];

  // 기술 스택 태그 클릭 핸들러
  const handleTagButtonClick = (tag) => {
    setProfile((prev) => {
      const newTechStack = new Set(prev.techStack);
      if (newTechStack.has(tag)) {
        newTechStack.delete(tag);
      } else {
        newTechStack.add(tag);
      }
      return { ...prev, techStack: Array.from(newTechStack) };
    });
  };

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const data = await apiGet('/api/v1/mypage/profile');
        // Map backend fields to frontend format
        setProfile({
          photo: data.profile_image || '',
          nickname: data.username || '',
          major: data.major || '',
          studentId: data.student_number || '',
          role: data.current_company || '',
          email: data.email || '',
          bio: data.self_description || '',
          techStack: data.tech_stack || [],
          status: data.education_status?.toLowerCase() || '',
          github: data.github_username ? `https://github.com/${data.github_username}` : '',
          portfolio: data.portfolio_link || '',
        });
        setError(null);
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setError('프로필을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // textarea 높이 조절
  useEffect(() => {
    if (bioRef.current && profile?.bio) {
      bioRef.current.style.height = 'auto';
      bioRef.current.style.height = bioRef.current.scrollHeight + 'px';
    }
  }, [profile?.bio]);

  // 모달 열기/닫기
  const openPhotoModal = () => {
    if (!profile) return;
    setIsPhotoModalOpen(true);
    setSelectedPhotoSrc(profile.photo || '');
  };
  const closePhotoModal = () => {
    setIsPhotoModalOpen(false);
  };

  // 파일 업로드 처리
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedPhotoSrc(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // 프로필 사진 변경 저장
  const savePhotoChange = () => {
    setProfile((prev) => ({ ...prev, photo: selectedPhotoSrc }));
    closePhotoModal();
  };

  // 프로필 정보 수정 핸들러
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  // 프로필 정보 저장
  const saveProfileSettings = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      // Map frontend fields back to backend format
      const updateData = {
        username: profile.nickname,
        major: profile.major,
        self_description: profile.bio,
        tech_stack: profile.techStack,
        education_status: profile.status.toUpperCase(),
        github_username: profile.github.replace('https://github.com/', ''),
        portfolio_link: profile.portfolio,
        current_company: profile.role,
      };

      await apiPatch('/api/v1/mypage/profile', updateData);
      alert('프로필 정보가 저장되었습니다!');
    } catch (err) {
      console.error('Failed to save profile:', err);
      alert('프로필 저장에 실패했습니다: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl p-6">
        <div className="text-center py-12">
          <div className="text-xl text-gray-400">프로필을 불러오는 중...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto max-w-7xl p-6">
        <div className="text-center py-12">
          <div className="text-xl text-red-400 mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // No profile loaded
  if (!profile) return null;

  const profileInitial = (profile.nickname || profile.email || 'U')[0].toUpperCase();

  return (
    <div className="container mx-auto max-w-7xl">
      {/* Profile Section */}
      <section id="profile" className="mb-8">
        <h3 className="orbitron text-2xl font-bold gradient-text mb-6">
          프로필 정보
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="widget-card p-6 rounded-xl text-center">
              <div
                className="profile-photo-container mx-auto mb-4"
                onClick={openPhotoModal}
              >
                {profile.photo ? (
                  <img
                    src={profile.photo}
                    alt="프로필 이미지"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gray-700 flex items-center justify-center text-white text-xl">
                    {profileInitial}
                  </div>
                )}
              </div>
              <div className="mb-4">
                <h4 className="orbitron text-xl font-bold mb-2 text-white">
                  {profile.nickname}
                </h4>
                <p className="text-blue-300 mb-2">
                  {profile.major} {profile.studentId}
                </p>
                <p className="text-sm text-gray-400">{profile.role}</p>
              </div>
              <div className="flex justify-center space-x-4">
                <a
                  href={profile.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-400 text-xl"
                >
                  <FontAwesomeIcon icon={faGithub} />
                </a>
                <a
                  href={profile.portfolio}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-purple-400 text-xl"
                >
                  <FontAwesomeIcon icon={faLink} />
                </a>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2">
            <div className="widget-card p-6 rounded-xl">
              <h5 className="orbitron text-lg font-bold mb-4 text-white">
                기본 정보
              </h5>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    닉네임
                  </label>
                  <input
                    type="text"
                    className="editable form-input"
                    name="nickname"
                    value={profile.nickname}
                    onChange={handleProfileChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    이메일
                  </label>
                  <input
                    type="email"
                    className="editable form-input"
                    name="email"
                    value={profile.email}
                    onChange={handleProfileChange}
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    자기소개
                  </label>
                  <textarea
                    ref={bioRef}
                    className="editable form-input"
                    rows="3"
                    name="bio"
                    value={profile.bio}
                    onChange={handleProfileChange}
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    기술 스택
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {profile.techStack.map((tag, index) => (
                      <span key={index} className={`tag ${getTagBgClass(tag)}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="editable form-input"
                    name="techStack"
                    value={profile.techStack.join(', ')}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        techStack: e.target.value
                          .split(',')
                          .map((s) => s.trim()),
                      }))
                    }
                  />
                </div>
                {/* 기술 스택 태그 버튼 추가 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    추천 기술 스택
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allTechTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`px-3 py-1 rounded-full text-xs font-medium hover:opacity-80 transition-colors 
                                    ${getTagBgClass(tag)} 
                                    ${profile.techStack.includes(tag) ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-white' : ''}`}
                        onClick={() => handleTagButtonClick(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    현재 상태
                  </label>
                  <select
                    className="editable form-input"
                    name="status"
                    value={profile.status}
                    onChange={handleProfileChange}
                  >
                    <option value="student">재학생</option>
                    <option value="intern">인턴</option>
                    <option value="employee">취업</option>
                    <option value="graduate">대학원</option>
                    <option value="other">기타</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    GitHub
                  </label>
                  <input
                    type="url"
                    className="editable form-input"
                    name="github"
                    value={profile.github}
                    onChange={handleProfileChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    포트폴리오/블로그
                  </label>
                  <input
                    type="url"
                    className="editable form-input"
                    name="portfolio"
                    value={profile.portfolio}
                    onChange={handleProfileChange}
                  />
                </div>
              </div>
              <div className="mt-6 flex space-x-4">
                <button
                  onClick={saveProfileSettings}
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? '저장 중...' : '수정하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* Profile Photo Modal */}
      {isPhotoModalOpen && (
        <div id="photo-modal" className="modal show" onClick={closePhotoModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="orbitron text-xl font-bold text-white">
                프로필 사진 변경
              </h3>
              <button
                onClick={closePhotoModal}
                className="text-gray-400 hover:text-white text-2xl"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>


            <div className="mb-6">
              <h4 className="font-semibold text-white mb-4">파일 업로드</h4>
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                <FontAwesomeIcon
                  icon={faCloudUploadAlt}
                  className="text-4xl text-gray-400 mb-4"
                />
                <p className="text-gray-400 mb-4">
                  이미지를 드래그하거나 클릭하여 업로드
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="photo-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-colors"
                >
                  파일 선택
                </button>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={savePhotoChange}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-colors"
              >
                저장
              </button>
              <button
                onClick={closePhotoModal}
                className="flex-1 px-4 py-2 border border-gray-600 rounded-lg hover:border-gray-400 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
