import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLink,
  faUserCircle,
  faIdCard,
  faQuoteLeft,
  faEnvelope,
  faCode,
  faBriefcase,
  faSave,
  faUndo,
  faLock,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';

function MemberPageSetting() {
  // 공개 설정 상태 관리
  const [settings, setSettings] = useState({
    email: true,
    techStack: true,
    career: true,
    github: true,
    portfolio: true,
  });

  // 미리보기 멤버 데이터 (데모용)
  const [memberPreview] = useState({
    photo: 'https://via.placeholder.com/120/A8C5E6/FFFFFF?text=김TCP',
    name: '김TCP',
    bio: '안녕하세요! TCP에서 활동 중인 김TCP입니다.',
    email: 'kimtcp@seoultech.ac.kr',
    career: '컴퓨터공학과 20학번 재학생',
    techStack: ['JavaScript', 'React', 'Node.js', 'Python', 'MySQL'],
    github: 'https://github.com/kimtcp',
    portfolio: 'https://portfolio.kimtcp.com',
  });

  const toggleSetting = (settingName) => {
    setSettings((prev) => ({ ...prev, [settingName]: !prev[settingName] }));
  };

  const saveSettings = () => {
    alert('설정이 저장되었습니다!');
    // 실제로는 여기에 API 호출 로직이 들어갑니다.
    console.log('Saved settings:', settings);
  };

  const resetSettings = () => {
    setSettings({
      email: true,
      techStack: true,
      career: true,
      github: true,
      portfolio: true,
    });
    alert('설정이 초기화되었습니다.');
  };

  return (
    <div className="container mx-auto max-w-7xl">
      <div className="mb-6">
        <h3 className="orbitron text-3xl font-bold gradient-text mb-2">
          멤버 페이지 공개 설정
        </h3>
        <p className="text-gray-400">
          멤버 페이지에서 다른 사람들에게 공개할 정보를 선택해주세요.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Settings Panel */}
        <div className="space-y-6">
          {/* Always Visible Section */}
          <div className="widget-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="orbitron text-xl font-bold text-white">
                항상 공개되는 정보
              </h4>
              <span className="notice-badge">필수</span>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              다음 정보는 멤버 페이지에서 항상 공개됩니다.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-800 bg-opacity-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FontAwesomeIcon
                    icon={faUserCircle}
                    className="text-blue-400"
                  />
                  <div>
                    <h5 className="font-semibold text-white">프로필 사진</h5>
                    <p className="text-sm text-gray-400">
                      설정된 프로필 이미지
                    </p>
                  </div>
                </div>
                <FontAwesomeIcon icon={faLock} className="text-gray-500" />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-800 bg-opacity-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faIdCard} className="text-green-400" />
                  <div>
                    <h5 className="font-semibold text-white">이름</h5>
                    <p className="text-sm text-gray-400">
                      {memberPreview.name}
                    </p>
                  </div>
                </div>
                <FontAwesomeIcon icon={faLock} className="text-gray-500" />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-800 bg-opacity-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FontAwesomeIcon
                    icon={faQuoteLeft}
                    className="text-purple-400"
                  />
                  <div>
                    <h5 className="font-semibold text-white">한 줄 소개</h5>
                    <p className="text-sm text-gray-400">{memberPreview.bio}</p>
                  </div>
                </div>
                <FontAwesomeIcon icon={faLock} className="text-gray-500" />
              </div>
            </div>
          </div>

          {/* Optional Information Section */}
          <div className="widget-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="orbitron text-xl font-bold text-white">
                선택적 공개 정보
              </h4>
              <span className="optional-badge">선택</span>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              다음 정보들은 원하는 경우에만 공개할 수 있습니다.
            </p>
            <div className="space-y-4">
              <div
                className="setting-item"
                onClick={() => toggleSetting('email')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <FontAwesomeIcon
                      icon={faEnvelope}
                      className="text-blue-400"
                    />
                    <div>
                      <h5 className="font-semibold text-white">이메일</h5>
                      <p className="text-sm text-gray-400">
                        {memberPreview.email}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`toggle-switch ${settings.email ? 'active' : ''}`}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  다른 멤버들이 연락할 수 있도록 이메일을 공개합니다.
                </p>
              </div>
              <div
                className="setting-item"
                onClick={() => toggleSetting('techStack')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <FontAwesomeIcon
                      icon={faCode}
                      className="text-purple-400"
                    />
                    <div>
                      <h5 className="font-semibold text-white">기술 스택</h5>
                      <p className="text-sm text-gray-400">
                        {memberPreview.techStack.join(', ')}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`toggle-switch ${settings.techStack ? 'active' : ''}`}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  보유한 기술 스택을 공개하여 협업 기회를 늘립니다.
                </p>
              </div>
              <div
                className="setting-item"
                onClick={() => toggleSetting('career')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <FontAwesomeIcon
                      icon={faBriefcase}
                      className="text-green-400"
                    />
                    <div>
                      <h5 className="font-semibold text-white">현재 상태</h5>
                      <p className="text-sm text-gray-400">
                        {memberPreview.career}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`toggle-switch ${settings.career ? 'active' : ''}`}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  현재 상태와 전공 정보를 공개합니다.
                </p>
              </div>
              <div
                className="setting-item"
                onClick={() => toggleSetting('github')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <FontAwesomeIcon
                      icon={faGithub}
                      className="text-pink-400"
                    />
                    <div>
                      <h5 className="font-semibold text-white">GitHub 링크</h5>
                      <p className="text-sm text-gray-400">
                        {memberPreview.github}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`toggle-switch ${settings.github ? 'active' : ''}`}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  GitHub 프로필 링크를 공개합니다.
                </p>
              </div>
              <div
                className="setting-item"
                onClick={() => toggleSetting('portfolio')}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <FontAwesomeIcon
                      icon={faLink}
                      className="text-yellow-400"
                    />
                    <div>
                      <h5 className="font-semibold text-white">
                        포트폴리오 링크
                      </h5>
                      <p className="text-sm text-gray-400">
                        {memberPreview.portfolio}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`toggle-switch ${settings.portfolio ? 'active' : ''}`}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  개인 포트폴리오나 블로그 링크를 공개합니다.
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex space-x-4">
            <button
              onClick={saveSettings}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-colors orbitron font-bold"
            >
              <FontAwesomeIcon icon={faSave} className="mr-2" />
              설정 저장
            </button>
            <button
              onClick={resetSettings}
              className="px-6 py-3 border border-gray-600 rounded-lg hover:border-gray-400 transition-colors"
            >
              <FontAwesomeIcon icon={faUndo} className="mr-2" />
              초기화
            </button>
          </div>
        </div>

        {/* Live Preview Panel */}
        <div className="preview-container">
          <div className="widget-card p-6 rounded-xl">
            <h4 className="orbitron text-xl font-bold gradient-text mb-4">
              실시간 미리보기
            </h4>
            <p className="text-sm text-gray-400 mb-6">
              설정 변경사항이 실시간으로 반영됩니다.
            </p>

            {/* Member Card Preview */}
            <div
              id="member-preview"
              className="member-card p-6 rounded-xl text-center card-hover"
            >
              <div className="img-container mx-auto">
                <img src={memberPreview.photo} alt="Profile Preview" />
              </div>
              <h3 className="orbitron text-xl font-bold mb-2 text-white">
                {memberPreview.name}
              </h3>
              <p className="text-blue-300 mb-4">{memberPreview.bio}</p>

              {/* Optional Information */}
              <div
                className={`mb-2 text-sm text-gray-300 ${!settings.email ? 'hidden-info' : ''}`}
              >
                <FontAwesomeIcon
                  icon={faEnvelope}
                  className="text-blue-400 mr-2"
                />
                {memberPreview.email}
              </div>

              <div
                className={`mb-4 text-sm text-gray-300 ${!settings.career ? 'hidden-info' : ''}`}
              >
                <FontAwesomeIcon
                  icon={faBriefcase}
                  className="text-green-400 mr-2"
                />
                {memberPreview.career}
              </div>

              <div
                className={`mb-4 ${!settings.techStack ? 'hidden-info' : ''}`}
              >
                {memberPreview.techStack.map((tag, index) => (
                  <span key={index} className="tech-tag">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex justify-center space-x-4">
                {settings.github && (
                  <a
                    href={memberPreview.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-400 text-xl"
                  >
                    <FontAwesomeIcon icon={faGithub} />
                  </a>
                )}
                {settings.portfolio && (
                  <a
                    href={memberPreview.portfolio}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-purple-400 text-xl"
                  >
                    <FontAwesomeIcon icon={faLink} />
                  </a>
                )}
              </div>
            </div>

            <div className="mt-4 p-4 bg-gray-800 bg-opacity-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <FontAwesomeIcon
                  icon={faInfoCircle}
                  className="text-blue-400"
                />
                <span className="text-sm font-semibold text-white">
                  미리보기 안내
                </span>
              </div>
              <p className="text-xs text-gray-400">
                위의 카드는 멤버 페이지에서 다른 사용자들이 보게 될 당신의
                프로필입니다. 설정을 변경하면 실시간으로 업데이트됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemberPageSetting;
