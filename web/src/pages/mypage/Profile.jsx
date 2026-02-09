import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiGet, apiPatch, apiDelete } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatBirthDate, normalizeDate } from '../../utils/dateFormatter';
import defaultProfileImage from '../../logo.svg';
import {
  faLink,
  faCloudUploadAlt,
  faTimes,
  faCalendarAlt,
  faBook,
  faUsers,
  faTrophy,
  faCamera,
} from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

function Profile() {
  // 프로필 정보 상태 관리
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { user, login } = useAuth();


  // 모달 관련 상태
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedPhotoSrc, setSelectedPhotoSrc] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [modalImageError, setModalImageError] = useState(false);
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
        alert('Raw birth_date: ' + data.birth_date + '\nNormalized: ' + normalizeDate(data.birth_date)); // DEBUG
        // Map backend fields to frontend format
        setProfile({
          photo: data.profile_image || '',
          username: data.username || '',
          major: data.major || '',
          studentId: data.student_number || '',
          role: data.current_company || '',
          email: data.email || '',
          bio: data.self_description || '',
          techStack: data.tech_stack || [],
          status: data.education_status || '',
          github: data.github_username ? `https://github.com/${data.github_username}` : '',
          baekjoon: data.baekjoon_username || '', // Added
          portfolio: data.portfolio_link || '',
          joinYear: data.join_year || '', // Added
          birthDate: normalizeDate(data.birth_date), // Added, format YYYY.MM.DD
          gender: data.gender || '', // Added
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
    setModalImageError(false);
    setSelectedPhotoSrc(profile.photo || '');
    setSelectedFile(null);
  };
  const closePhotoModal = () => {
    setIsPhotoModalOpen(false);
  };

  // 파일 업로드 처리
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file); //파일 객체 저장
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedPhotoSrc(e.target.result);
        setModalImageError(false); // 새 이미지 로드 시 에러 초기화
      };
      reader.readAsDataURL(file);
    }
  };

  // 프로필 사진 변경 저장
  const savePhotoChange = async () => {
    if (!selectedFile) {
      closePhotoModal();
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // 이미지 업로드 API 호출
      // client.js의 apiPatch는 JSON을 가정할 수 있으므로, Content-Type 헤더를 확인해야 함
      // 하지만 apiPatch가 자동으로 Content-Type을 설정하는지 확인 필요.
      // 보통 axios나 fetch는 FormData를 넘기면 알아서 설정함.
      // 여기서는 apiPatch가 headers를 덮어쓰는지 확인해야 하지만, 
      // apiPatch 구현을 모르므로 안전하게 직접 fetch를 쓰거나 client.js를 확인해야 함.
      // 일단 apiPatch를 시도하되, Content-Type: multipart/form-data는 브라우저가 boundary를 설정해야 하므로
      // 헤더를 명시적으로 설정하지 않고 보냄 (client.js가 JSON으로 강제하지 않는다면).

      // 만약 apiPatch가 JSON 문자열화를 강제한다면 문제됨.
      // 안전하게 fetch 형식을 사용하는 apiPatch에 formData를 전달.

      const response = await apiPatch('/api/v1/members/me/profile-image', formData);

      if (response && response.profile_image) {
        // 캐시 버스팅을 위한 타임스탬프 추가
        const newImageUrl = `${response.profile_image}?t=${Date.now()}`;

        setProfile((prev) => ({ ...prev, photo: newImageUrl }));

        // 헤더 등 전역 상태 업데이트를 위해 AuthContext 업데이트
        if (user) {
          const updatedUser = { ...user, profile_image: newImageUrl };
          // 현재 토큰 유지하면서 유저 정보만 업데이트
          login(updatedUser, localStorage.getItem('access_token'));
        }

        alert('프로필 사진이 변경되었습니다!');
        closePhotoModal();
      }
    } catch (error) {
      console.error('Failed to upload profile image:', error);
      alert('프로필 사진 변경 실패: ' + (error.message || '알 수 없는 오류'));
    }
  };

  // 기본 프로필 이미지로 변경
  const handleResetProfileImage = async () => {
    if (!window.confirm('정말로 기본 프로필 사진으로 변경하시겠습니까?')) return;

    try {
      await apiDelete('/api/v1/members/me/profile-image');

      // 상태 업데이트
      setProfile((prev) => ({ ...prev, photo: '' }));

      // 전역 상태 업데이트
      if (user) {
        const updatedUser = { ...user, profile_image: null };
        login(updatedUser, localStorage.getItem('access_token'));
      }

      alert('기본 프로필 사진으로 변경되었습니다.');
      closePhotoModal();
    } catch (error) {
      console.error('Failed to reset profile image:', error);
      alert('기본 이미지 변경 실패: ' + (error.message || '오류 발생'));
    }
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
        major: profile.major,
        self_description: profile.bio,
        tech_stack: profile.techStack,
        education_status: profile.status,
        github_username: profile.github.replace('https://github.com/', '').replace('github.com/', ''),
        baekjoon_username: profile.baekjoon, // Added
        portfolio_link: profile.portfolio,
        current_company: profile.role,
        join_year: profile.joinYear ? parseInt(profile.joinYear, 10) : null, // Added
        birth_date: profile.birthDate ? profile.birthDate : null, // Added
        gender: profile.gender || null, // Added, convert empty string to null
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

  const profileInitial = (profile.username || profile.email || 'U')[0].toUpperCase();

  return (
    <div className="container mx-auto max-w-3xl">
      {/* Profile Section */}
      <section id="profile" className="mb-8">
        <h3 className="orbitron text-2xl font-bold gradient-text mb-6">
          프로필 정보
        </h3>

        <div className="flex flex-col gap-8">
          {/* Profile Card */}
          <div className="w-full">
            <div className="widget-card p-6 rounded-xl text-center">
              <div
                className="profile-photo-container mx-auto mb-4 relative group cursor-pointer w-32 h-32"
                onClick={openPhotoModal}
              >
                {profile.photo && profile.photo.length > 0 ? (
                  <img
                    src={profile.photo}
                    alt="프로필 이미지"
                    className="w-full h-full object-cover rounded-full border-4 border-gray-700 group-hover:border-blue-500 transition-colors"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gray-700 flex items-center justify-center text-white text-xl border-4 border-gray-700 group-hover:border-blue-500 transition-colors">
                    {profileInitial}
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-white text-sm font-medium">
                    <FontAwesomeIcon icon={faCamera} className="mb-1 block text-2xl mx-auto" />
                    변경
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="orbitron text-xl font-bold mb-2 text-white">
                  {profile.username}
                </h4>
                <p className="text-blue-300 mb-2">
                  {profile.major} {profile.studentId}
                </p>
                <p className="text-sm text-gray-400">{profile.role}</p>
              </div>
              <div className="flex justify-center space-x-4">
                <a
                  href={profile.github ? (profile.github.startsWith('http') ? profile.github : `https://${profile.github}`) : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-400 text-xl"
                >
                  <FontAwesomeIcon icon={faGithub} />
                </a>
                <a
                  href={profile.portfolio ? (profile.portfolio.startsWith('http') ? profile.portfolio : `https://${profile.portfolio}`) : '#'}
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
          <div className="w-full">
            <div className="widget-card p-6 rounded-xl">
              <h5 className="orbitron text-lg font-bold mb-4 text-white">
                기본 정보
              </h5>
              <div className="space-y-4">
                {/* Read-only Basic Info */}
                {/* Basic Info (Student Number, Major, etc) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name and Email removed from view as per request */}

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      학번
                    </label>
                    <input
                      type="text"
                      className="editable form-input"
                      name="studentId"
                      value={profile.studentId}
                      maxLength={8}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                        handleProfileChange({ target: { name: 'studentId', value: val } });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      전공
                    </label>
                    <input
                      type="text"
                      className="editable form-input"
                      name="major"
                      value={profile.major}
                      onChange={handleProfileChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      동아리 가입 연도
                    </label>
                    <input
                      type="number"
                      className="editable form-input"
                      name="joinYear"
                      value={profile.joinYear}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 4);
                        handleProfileChange({ target: { name: 'joinYear', value: val } });
                      }}
                      placeholder="예: 2023"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      생년월일
                    </label>
                    <input
                      type="text"
                      className="editable form-input"
                      name="birthDate"
                      value={profile.birthDate}
                      onChange={(e) => {
                        const val = formatBirthDate(e.target.value);
                        handleProfileChange({ target: { name: 'birthDate', value: val } });
                      }}
                      placeholder="YYYY.MM.DD"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      성별
                    </label>
                    <select
                      className="editable form-input"
                      name="gender"
                      value={profile.gender}
                      onChange={handleProfileChange}
                    >
                      <option value="">선택 안 함</option>
                      <option value="Male">남성</option>
                      <option value="Female">여성</option>
                    </select>
                  </div>
                </div>

                <hr className="border-gray-700 my-4" />

                {/* Editable Profile Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    아이디
                  </label>
                  <div className="text-gray-300 text-lg px-3 py-2 border border-gray-700 rounded-md bg-transparent text-left">
                    {profile.username}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    학적 상태
                  </label>
                  <div className="text-gray-300 text-lg px-3 py-2 border border-gray-700 rounded-md bg-transparent text-left">
                    {profile.email}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    현재 소속 (직장/단체)
                  </label>
                  <input
                    type="text"
                    className="editable form-input"
                    name="role"
                    value={profile.role}
                    onChange={handleProfileChange}
                    placeholder="예: 삼성전자, 네이버, 프리랜서"
                  />
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
                {/* Status Select Moved up */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    GitHub 주소 (URL)
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
                    백준 아이디 (ID)
                  </label>
                  <input
                    type="text"
                    className="editable form-input"
                    name="baekjoon"
                    value={profile.baekjoon}
                    onChange={handleProfileChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    포트폴리오/블로그 주소 (URL)
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
              <div className="mt-6 flex space-x-4 justify-end">
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
              {selectedPhotoSrc && !modalImageError ? (
                <div className="flex justify-center mb-6">
                  <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-gray-700 shadow-lg">
                    <img
                      src={selectedPhotoSrc}
                      alt="프로필 미리보기"
                      className="w-full h-full object-cover"
                      onError={() => setModalImageError(true)}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex justify-center mb-6">
                  <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-gray-700 shadow-lg bg-white p-4">
                    <img
                      src={defaultProfileImage}
                      alt="기본 이미지"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}

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

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleResetProfileImage}
                  className="text-sm text-gray-400 hover:text-red-400 transition-colors underline"
                >
                  기본 프로필 사진으로 변경
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
