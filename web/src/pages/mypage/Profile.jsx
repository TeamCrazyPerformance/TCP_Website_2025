import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
import { apiGet, apiPatch, apiPatchMultipart } from '../../api/client';

function Profile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 프로필 정보 상태 관리
  const [profile, setProfile] = useState({
    photo: '',
    nickname: '',
    major: '',
    studentId: '',
    role: '',
    email: '',
    bio: '',
    techStack: [],
    status: 'student',
    github: '',
    portfolio: '',
  });

  // 통계 상태 (데모 데이터 - 백엔드 API 미구현 시 유지, 추후 연동)
  const [stats] = useState({
    joinPeriod: '2년 3개월',
    joinDate: '2022년 3월',
    studies: 8,
    studiesOngoing: 2,
    studiesCompleted: 6,
    teams: 3,
    teamsLeader: 1,
    teamsMember: 2,
    competitions: 2,
    competitionsAwards: 1,
  });

  // 최근 활동 상태 (데모 데이터 - 백엔드 API 미구현 시 유지, 추후 연동)
  const [activities] = useState([
    {
      title: 'React 심화 스터디',
      desc: '새로운 스터디에 참여했습니다',
      time: '2시간 전',
      icon: faBook,
      color: 'text-blue-400',
    },
    {
      title: '해커톤 팀 모집',
      desc: '새로운 팀 모집 글을 작성했습니다',
      time: '1일 전',
      icon: faUsers,
      color: 'text-green-400',
    },
    {
      title: '알고리즘 대회 참가',
      desc: 'ICPC 대회에 참가 신청했습니다',
      time: '3일 전',
      icon: faTrophy,
      color: 'text-yellow-400',
    },
  ]);

  // 모달 관련 상태
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [previewPhotoSrc, setPreviewPhotoSrc] = useState(null);
  const fileInputRef = useRef(null);

  // textarea 자동 높이 조절을 위한 ref
  const bioRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/v1/mypage/profile');

      // API 응답 데이터를 상태에 매핑
      setProfile({
        photo: data.profile_image ? (data.profile_image.startsWith('http') ? data.profile_image : `${process.env.REACT_APP_API_BASE || ''}/uploads/profiles/${data.profile_image}`) : 'https://via.placeholder.com/150/A8C5E6/FFFFFF?text=NoImage',
        nickname: data.name || '',
        major: data.major || '',
        studentId: data.student_number ? `${data.student_number.substring(2, 4)}학번` : '',
        role: data.role || 'Member',
        email: data.email || '',
        bio: data.self_description || '',
        techStack: data.tech_stack || [],
        status: data.education_status || 'student', // enum 매핑 필요 시 조정
        github: data.github_username || '',
        portfolio: data.portfolio_link || '',
      });
    } catch (err) {
      console.error('프로필 불러오기 실패:', err);
      setError('프로필 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

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
    'JavaScript', 'React', 'TypeScript', 'Node.js', 'Python', 'C++', 'Java', 'Spring', 'Next.js',
    'MySQL', 'MongoDB', 'Flutter', 'Swift', 'Kotlin', 'Unity', 'C#', 'CSS', 'TailwindCSS',
    'AI', 'TensorFlow', 'PyTorch', 'Hugging Face', 'DevOps', 'Kubernetes', 'Docker', 'AWS',
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

  // textarea 높이 조절
  useEffect(() => {
    if (bioRef.current) {
      bioRef.current.style.height = 'auto';
      bioRef.current.style.height = bioRef.current.scrollHeight + 'px';
    }
  }, [profile.bio]);

  // 모달 열기/닫기
  const openPhotoModal = () => {
    setIsPhotoModalOpen(true);
    setPreviewPhotoSrc(profile.photo);
    setSelectedPhotoFile(null);
  };
  const closePhotoModal = () => {
    setIsPhotoModalOpen(false);
    setSelectedPhotoFile(null);
    setPreviewPhotoSrc(null);
  };

  // 파일 업로드 처리 (미리보기)
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewPhotoSrc(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // 프로필 사진 변경 저장 (실제 업로드)
  const savePhotoChange = async () => {
    if (!selectedPhotoFile) {
      closePhotoModal();
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', selectedPhotoFile);

      const response = await apiPatchMultipart('/api/v1/members/me/profile-image', formData);

      // 업로드 성공 후 프로필 상태 업데이트
      // response.profile_image는 서버에서 반환된 파일 경로 (db에 저장된 값)
      const newPhotoUrl = response.profile_image.startsWith('http')
        ? response.profile_image
        : `${process.env.REACT_APP_API_BASE || ''}/uploads/profiles/${response.profile_image}`;

      setProfile(prev => ({ ...prev, photo: newPhotoUrl }));
      alert('프로필 사진이 변경되었습니다.');
      closePhotoModal();
    } catch (err) {
      console.error('사진 업로드 실패:', err);
      alert('사진 업로드에 실패했습니다: ' + err.message);
    }
  };

  // 프로필 정보 수정 핸들러
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  // 프로필 정보 저장
  const saveProfileSettings = async () => {
    try {
      const updateData = {
        self_description: profile.bio,
        tech_stack: profile.techStack,
        education_status: profile.status,
        github_username: profile.github,
        portfolio_link: profile.portfolio
      };

      await apiPatch('/api/v1/mypage/profile', updateData);
      alert('프로필 정보가 저장되었습니다!');
    } catch (err) {
      console.error('프로필 저장 실패:', err);
      alert('프로필 저장에 실패했습니다.');
    }
  };

  if (loading) return <div className="text-center py-10 text-white">Loading...</div>;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;

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
                className="profile-photo-container mx-auto mb-4 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={openPhotoModal}
                title="프로필 사진 변경"
              >
                <img
                  src={profile.photo}
                  alt="프로필 사진"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/150/555/FFF?text=Error'; }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity rounded-full">
                  <FontAwesomeIcon icon={faCloudUploadAlt} className="text-white text-2xl" />
                </div>
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
                {profile.github && (
                  <a
                    href={profile.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-400 text-xl"
                  >
                    <FontAwesomeIcon icon={faGithub} />
                  </a>
                )}
                {profile.portfolio && (
                  <a
                    href={profile.portfolio}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-purple-400 text-xl"
                  >
                    <FontAwesomeIcon icon={faLink} />
                  </a>
                )}
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
                    닉네임 (변경 불가)
                  </label>
                  <input
                    type="text"
                    className="editable form-input opacity-50 cursor-not-allowed"
                    name="nickname"
                    value={profile.nickname}
                    readOnly
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
                  {/* 기술 스택 직접 입력 필드 제거 또는 숨김, 태그 선택으로 유도 */}
                </div>
                {/* 기술 스택 태그 버튼 추가 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    추천 기술 스택
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-700 rounded-lg">
                    {allTechTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`px-3 py-1 rounded-full text-xs font-medium hover:opacity-80 transition-colors 
                                    ${getTagBgClass(tag)} 
                                    ${profile.techStack.includes(tag) ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-white' : 'opacity-60'}`}
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
                    <option value="Enrolled">재학생 (Enrolled)</option>
                    <option value="Absence">휴학생 (Absence)</option>
                    <option value="Graduated">졸업생 (Graduated)</option>
                    <option value="Completion">수료생 (Completion)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    GitHub 사용자명
                  </label>
                  <input
                    type="text"
                    className="editable form-input"
                    name="github"
                    value={profile.github}
                    onChange={handleProfileChange}
                    placeholder="예: kimtcp"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    https://github.com/<strong>{profile.github || 'username'}</strong>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    포트폴리오 링크
                  </label>
                  <input
                    type="url"
                    className="editable form-input"
                    name="portfolio"
                    value={profile.portfolio}
                    onChange={handleProfileChange}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="mt-6 flex space-x-4">
                <button onClick={saveProfileSettings} className="btn-primary">
                  정보 수정 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Activity Statistics */}
      <section className="mb-8">
        <h3 className="orbitron text-2xl font-bold gradient-text mb-6">
          활동 통계
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="stat-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <FontAwesomeIcon
                icon={faCalendarAlt}
                className="text-blue-400 text-2xl"
              />
              <span className="text-2xl font-bold gradient-text">
                {stats.joinPeriod}
              </span>
            </div>
            <h4 className="font-semibold text-white mb-1">가입 기간</h4>
            <p className="text-sm text-gray-400">{stats.joinDate}부터</p>
          </div>

          <div className="stat-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <FontAwesomeIcon
                icon={faBook}
                className="text-purple-400 text-2xl"
              />
              <span className="text-2xl font-bold gradient-text">
                {stats.studies}
              </span>
            </div>
            <h4 className="font-semibold text-white mb-1">참여 스터디</h4>
            <p className="text-sm text-gray-400">
              완료: {stats.studiesCompleted}개, 진행 중: {stats.studiesOngoing}
              개
            </p>
          </div>

          <div className="stat-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <FontAwesomeIcon
                icon={faUsers}
                className="text-green-400 text-2xl"
              />
              <span className="text-2xl font-bold gradient-text">
                {stats.teams}
              </span>
            </div>
            <h4 className="font-semibold text-white mb-1">팀 프로젝트</h4>
            <p className="text-sm text-gray-400">
              리더: {stats.teamsLeader}개, 멤버: {stats.teamsMember}개
            </p>
          </div>

          <div className="stat-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <FontAwesomeIcon
                icon={faTrophy}
                className="text-yellow-400 text-2xl"
              />
              <span className="text-2xl font-bold gradient-text">
                {stats.competitions}
              </span>
            </div>
            <h4 className="font-semibold text-white mb-1">대회 참가</h4>
            <p className="text-sm text-gray-400">
              수상: {stats.competitionsAwards}회
            </p>
          </div>
        </div>
      </section>

      {/* Recent Activities */}
      <section className="mb-8">
        <h3 className="orbitron text-2xl font-bold gradient-text mb-6">
          최근 활동
        </h3>

        <div className="widget-card rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-700">
            {activities.map((activity, index) => (
              <div
                key={index}
                className="p-4 hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FontAwesomeIcon
                      icon={activity.icon}
                      className={activity.color}
                    />
                    <div>
                      <h5 className="font-semibold text-white">
                        {activity.title}
                      </h5>
                      <p className="text-sm text-gray-400">{activity.desc}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              </div>
            ))}
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
              <h4 className="font-semibold text-white mb-4">
                새 프로필 이미지 선택
              </h4>

              <div className="flex justify-center mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-slate-600">
                  <img src={previewPhotoSrc} alt="Preview" className="w-full h-full object-cover" />
                </div>
              </div>

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
                disabled={!selectedPhotoFile}
                className={`flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg transition-colors ${!selectedPhotoFile ? 'opacity-50 cursor-not-allowed' : 'hover:from-blue-600 hover:to-purple-600'}`}
              >
                변경 사항 저장
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
