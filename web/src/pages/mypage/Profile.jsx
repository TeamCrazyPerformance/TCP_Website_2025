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

function Profile() {
  // 프로필 정보 상태 관리
  const [profile, setProfile] = useState({
    photo: 'https://via.placeholder.com/150/A8C5E6/FFFFFF?text=김TCP',
    nickname: '김TCP',
    major: '컴퓨터공학과',
    studentId: '20학번',
    role: 'Full-Stack Developer',
    email: 'kimtcp@seoultech.ac.kr',
    bio: '안녕하세요! TCP에서 활동 중인 김TCP입니다. 웹 개발과 알고리즘에 관심이 많고, 새로운 기술을 배우는 것을 좋아합니다.',
    techStack: ['JavaScript', 'React', 'Node.js', 'Python', 'MySQL'],
    status: 'student',
    github: 'https://github.com/kimtcp',
    portfolio: 'https://portfolio.kimtcp.com',
  });

  // 통계 상태 (데모 데이터)
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

  // 최근 활동 상태 (데모 데이터)
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
  const [selectedPhotoSrc, setSelectedPhotoSrc] = useState(profile.photo);
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
    setSelectedPhotoSrc(profile.photo);
  };
  const closePhotoModal = () => {
    setIsPhotoModalOpen(false);
  };

  // 프리셋 사진 선택
  const selectPresetPhoto = (src) => {
    setSelectedPhotoSrc(src);
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
  const saveProfileSettings = () => {
    alert('프로필 정보가 저장되었습니다!');
  };

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
                <img
                  src={profile.photo}
                  alt="프로필 사진"
                  className="w-full h-full object-cover"
                />
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
                <button onClick={saveProfileSettings} className="btn-primary">
                  수정하기
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
                프리셋 이미지 선택
              </h4>
              <div className="grid grid-cols-4 gap-4">
                {[
                  'https://via.placeholder.com/80/A8C5E6/FFFFFF?text=1',
                  'https://via.placeholder.com/80/C5A8E6/FFFFFF?text=2',
                  'https://via.placeholder.com/80/A8E6C5/FFFFFF?text=3',
                  'https://via.placeholder.com/80/E6A8C5/FFFFFF?text=4',
                ].map((src, index) => (
                  <img
                    key={index}
                    src={src}
                    alt={`Preset ${index + 1}`}
                    className="preset-photo"
                    style={{
                      borderColor:
                        selectedPhotoSrc === src.replace('80', '150')
                          ? 'var(--accent-blue)'
                          : 'transparent',
                    }}
                    onClick={() => selectPresetPhoto(src.replace('80', '150'))}
                  />
                ))}
              </div>
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
