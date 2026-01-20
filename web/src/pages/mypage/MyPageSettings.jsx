import React, { useState, useEffect } from 'react';

const MyPageSettings = () => {
    const [settings, setSettings] = useState({
        email: true,
        techstack: true,
        career: true,
        github: true,
        portfolio: true
    });

    const toggleSetting = (setting) => {
        setSettings(prev => ({ ...prev, [setting]: !prev[setting] }));
    };

    const resetSettings = () => {
        setSettings({ email: true, techstack: true, career: true, github: true, portfolio: true });
    };

    const saveSettings = () => {
        // Mock saving to server
        alert('설정이 저장되었습니다.');
        console.log('Settings saved:', settings);
    };

    return (
        <div className="container mx-auto max-w-7xl">
            <div className="mb-6">
                <h3 className="text-3xl font-bold gradient-text mb-2">멤버 페이지 공개 설정</h3>
                <p className="text-gray-400">멤버 페이지에서 다른 사람들에게 공개할 정보를 선택해주세요.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Settings Panel */}
                <div className="space-y-6">
                    <div className="widget-card p-6 rounded-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xl font-bold text-white">항상 공개되는 정보</h4>
                            <span className="notice-badge">필수</span>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">다음 정보는 멤버 페이지에서 항상 공개됩니다.</p>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-800 bg-opacity-50 rounded-lg"><div className="flex items-center space-x-3"><i className="fas fa-user-circle text-blue-400"></i><div><h5 className="font-semibold text-white">프로필 사진</h5><p className="text-sm text-gray-400">설정된 프로필 이미지</p></div></div><i className="fas fa-lock text-gray-500"></i></div>
                            <div className="flex items-center justify-between p-4 bg-gray-800 bg-opacity-50 rounded-lg"><div className="flex items-center space-x-3"><i className="fas fa-id-card text-green-400"></i><div><h5 className="font-semibold text-white">이름</h5><p className="text-sm text-gray-400">Admin Kim</p></div></div><i className="fas fa-lock text-gray-500"></i></div>
                            <div className="flex items-center justify-between p-4 bg-gray-800 bg-opacity-50 rounded-lg"><div className="flex items-center space-x-3"><i className="fas fa-quote-left text-purple-400"></i><div><h5 className="font-semibold text-white">한 줄 소개</h5><p className="text-sm text-gray-400">안녕하세요! TCP에서 활동 중인 Admin Kim입니다.</p></div></div><i className="fas fa-lock text-gray-500"></i></div>
                        </div>
                    </div>

                    <div className="widget-card p-6 rounded-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xl font-bold text-white">선택적 공개 정보</h4>
                            <span className="optional-badge">선택</span>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">다음 정보들은 원하는 경우에만 공개할 수 있습니다.</p>
                        <div className="space-y-4">
                            <SettingItem settingKey="email" label="이메일" value="kimtcp@seoultech.ac.kr" helpText="다른 멤버들이 연락할 수 있도록 이메일을 공개합니다." icon="fa-envelope text-blue-400" isActive={settings.email} onToggle={toggleSetting} />
                            <SettingItem settingKey="techstack" label="기술 스택" value="JavaScript, React, Node.js, Python, MySQL" helpText="보유한 기술 스택을 공개하여 협업 기회를 늘립니다." icon="fa-code text-purple-400" isActive={settings.techstack} onToggle={toggleSetting} />
                            <SettingItem settingKey="career" label="현재 상태" value="컴퓨터공학과 20학번 재학생" helpText="현재 상태와 전공 정보를 공개합니다." icon="fa-briefcase text-green-400" isActive={settings.career} onToggle={toggleSetting} />
                            <SettingItem settingKey="github" label="GitHub 링크" value="github.com/kimtcp" helpText="GitHub 프로필 링크를 공개합니다." icon="fab fa-github text-pink-400" isActive={settings.github} onToggle={toggleSetting} />
                            <SettingItem settingKey="portfolio" label="포트폴리오 링크" value="portfolio.kimtcp.com" helpText="개인 포트폴리오나 블로그 링크를 공개합니다." icon="fa-link text-yellow-400" isActive={settings.portfolio} onToggle={toggleSetting} />
                        </div>
                    </div>

                    <div className="flex space-x-4">
                        <button onClick={saveSettings} className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-colors font-bold"><i className="fas fa-save mr-2"></i>설정 저장</button>
                        <button onClick={resetSettings} className="px-6 py-3 border border-gray-600 rounded-lg hover:border-gray-400 transition-colors"><i className="fas fa-undo mr-2"></i>초기화</button>
                    </div>
                </div>

                {/* Live Preview Panel */}
                <div className="preview-container">
                    <div className="widget-card p-6 rounded-xl">
                        <h4 className="text-xl font-bold gradient-text mb-4">실시간 미리보기</h4>
                        <p className="text-sm text-gray-400 mb-6">설정 변경사항이 실시간으로 반영됩니다.</p>
                        <MemberCardPreview settings={settings} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const SettingItem = ({ settingKey, label, value, helpText, icon, isActive, onToggle }) => (
    <div className="setting-item">
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
                <i className={`fas ${icon}`}></i>
                <div>
                    <h5 className="font-semibold text-white">{label}</h5>
                    <p className="text-sm text-gray-400">{value}</p>
                </div>
            </div>
            <div className={`toggle-switch ${isActive ? 'active' : ''}`} onClick={() => onToggle(settingKey)}></div>
        </div>
        <p className="text-xs text-gray-500">{helpText}</p>
    </div>
);

const MemberCardPreview = ({ settings }) => (
    <div className="member-card p-6 rounded-xl text-center card-hover">
        <div className="img-container mx-auto">
            <img src="https://via.placeholder.com/120/A8C5E6/FFFFFF?text=김TCP" alt="Profile Preview" />
        </div>
        <h3 className="text-xl font-bold mb-2 text-white">Admin Kim</h3>
        <p className="text-blue-300 mb-4">안녕하세요! TCP에서 활동 중인 Admin Kim입니다.</p>
        
        {settings.email && <div className="mb-2 text-sm text-gray-300"><i className="fas fa-envelope text-blue-400 mr-2"></i>kimtcp@seoultech.ac.kr</div>}
        {settings.career && <div className="mb-4 text-sm text-gray-300"><i className="fas fa-graduation-cap text-green-400 mr-2"></i>컴퓨터공학과 20학번 재학생</div>}
        
        {settings.techstack && <div className="mb-4"><span className="tech-tag">JavaScript</span><span className="tech-tag">React</span><span className="tech-tag">Node.js</span></div>}
        
        <div className="flex justify-center space-x-4">
            {settings.github && <a href="#" target="_blank" className="text-gray-400 hover:text-blue-400 text-xl"><i className="fab fa-github"></i></a>}
            {settings.portfolio && <a href="#" target="_blank" className="text-gray-400 hover:text-purple-400 text-xl"><i className="fas fa-link"></i></a>}
        </div>
    </div>
);

export default MyPageSettings;