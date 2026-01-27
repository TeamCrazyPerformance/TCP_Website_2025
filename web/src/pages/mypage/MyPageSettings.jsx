import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch } from '../../api/client';

const buildSettingsState = (data) => ({
    email: Boolean(data?.is_public_email),
    techstack: Boolean(data?.is_public_tech_stack),
    career: Boolean(data?.is_public_education_status),
    github: Boolean(data?.is_public_github_username),
    portfolio: Boolean(data?.is_public_portfolio_link),
});

const MyPageSettings = () => {
    const [settings, setSettings] = useState(null);
    const [initialSettings, setInitialSettings] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let mounted = true;

        const fetchSettings = async () => {
            try {
                setLoading(true);
                const [privacyData, profileData] = await Promise.all([
                    apiGet('/api/v1/mypage/privacy'),
                    apiGet('/api/v1/mypage/profile'),
                ]);
                if (!mounted) return;

                const nextSettings = buildSettingsState(privacyData);
                setSettings(nextSettings);
                setInitialSettings(nextSettings);
                setProfile(profileData || {});
            } catch (err) {
                console.error('Failed to fetch privacy settings:', err);
                setSettings(buildSettingsState(null));
                setInitialSettings(buildSettingsState(null));
                setProfile({});
                alert('설정을 불러오지 못했습니다.');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchSettings();
        return () => {
            mounted = false;
        };
    }, []);

    const isDirty = useMemo(() => {
        if (!settings || !initialSettings) return false;
        return JSON.stringify(settings) !== JSON.stringify(initialSettings);
    }, [settings, initialSettings]);

    const toggleSetting = (setting) => {
        if (!settings) return;
        setSettings((prev) => ({ ...prev, [setting]: !prev[setting] }));
    };

    const resetSettings = () => {
        if (!initialSettings) return;
        setSettings(initialSettings);
    };

    const saveSettings = async () => {
        if (!settings || saving) return;
        setSaving(true);
        try {
            await apiPatch('/api/v1/mypage/privacy', {
                is_public_email: settings.email,
                is_public_tech_stack: settings.techstack,
                is_public_education_status: settings.career,
                is_public_github_username: settings.github,
                is_public_portfolio_link: settings.portfolio,
            });
            setInitialSettings(settings);
            alert('설정이 저장되었습니다.');
        } catch (err) {
            console.error('Failed to save privacy settings:', err);
            alert('설정 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !settings || !profile) {
        return (
            <div className="container mx-auto max-w-7xl p-6">
                <div className="text-center text-gray-400">설정을 불러오는 중...</div>
            </div>
        );
    }

    const techStack = Array.isArray(profile.tech_stack) ? profile.tech_stack : [];
    const displayName = profile.name || '미등록';
    const bio = profile.self_description || '';
    const email = profile.email || '';
    const educationStatus = profile.education_status || '';
    const github = profile.github_username ? `https://github.com/${profile.github_username}` : '';
    const portfolio = profile.portfolio_link || '';

    return (
        <div className="container mx-auto max-w-7xl">
            <div className="mb-6">
                <h3 className="text-3xl font-bold gradient-text mb-2">멤버 페이지 공개 설정</h3>
                <p className="text-gray-400">멤버 페이지에 공개할 정보를 선택하세요.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="widget-card p-6 rounded-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xl font-bold text-white">기본 공개 정보</h4>
                            <span className="notice-badge">필수</span>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">이 항목은 멤버 페이지에서 항상 공개됩니다.</p>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-800 bg-opacity-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <i className="fas fa-user-circle text-blue-400"></i>
                                    <div>
                                        <h5 className="font-semibold text-white">프로필 이미지</h5>
                                        <p className="text-sm text-gray-400">프로필 사진 또는 이니셜</p>
                                    </div>
                                </div>
                                <i className="fas fa-lock text-gray-500"></i>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-gray-800 bg-opacity-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <i className="fas fa-id-card text-green-400"></i>
                                    <div>
                                        <h5 className="font-semibold text-white">이름</h5>
                                        <p className="text-sm text-gray-400">{displayName}</p>
                                    </div>
                                </div>
                                <i className="fas fa-lock text-gray-500"></i>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-gray-800 bg-opacity-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <i className="fas fa-quote-left text-purple-400"></i>
                                    <div>
                                        <h5 className="font-semibold text-white">자기소개</h5>
                                        <p className="text-sm text-gray-400">{bio || '자기소개를 입력해주세요.'}</p>
                                    </div>
                                </div>
                                <i className="fas fa-lock text-gray-500"></i>
                            </div>
                        </div>
                    </div>

                    <div className="widget-card p-6 rounded-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xl font-bold text-white">선택 공개 항목</h4>
                            <span className="optional-badge">선택</span>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">공개 여부를 직접 선택할 수 있습니다.</p>
                        <div className="space-y-4">
                            <SettingItem settingKey="email" label="이메일" value={email || '미등록'} helpText="멤버 페이지에 이메일을 표시합니다." icon="fa-envelope text-blue-400" isActive={settings.email} onToggle={toggleSetting} />
                            <SettingItem settingKey="techstack" label="기술 스택" value={techStack.length ? techStack.join(', ') : '미등록'} helpText="기술 스택을 멤버 페이지에 표시합니다." icon="fa-code text-purple-400" isActive={settings.techstack} onToggle={toggleSetting} />
                            <SettingItem settingKey="career" label="재학 상태" value={educationStatus || '미등록'} helpText="재학 상태를 멤버 페이지에 표시합니다." icon="fa-briefcase text-green-400" isActive={settings.career} onToggle={toggleSetting} />
                            <SettingItem settingKey="github" label="GitHub" value={github || '미등록'} helpText="GitHub 프로필을 멤버 페이지에 표시합니다." icon="fab fa-github text-pink-400" isActive={settings.github} onToggle={toggleSetting} />
                            <SettingItem settingKey="portfolio" label="포트폴리오" value={portfolio || '미등록'} helpText="포트폴리오 링크를 멤버 페이지에 표시합니다." icon="fa-link text-yellow-400" isActive={settings.portfolio} onToggle={toggleSetting} />
                        </div>
                    </div>

                    <div className="flex space-x-4">
                        <button onClick={saveSettings} className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-colors font-bold" disabled={!isDirty || saving}>
                            <i className="fas fa-save mr-2"></i>{saving ? '저장 중...' : '설정 저장'}
                        </button>
                        <button onClick={resetSettings} className="px-6 py-3 border border-gray-600 rounded-lg hover:border-gray-400 transition-colors" disabled={!isDirty}>
                            <i className="fas fa-undo mr-2"></i>변경 취소
                        </button>
                    </div>
                </div>

                <div className="preview-container">
                    <div className="widget-card p-6 rounded-xl">
                        <h4 className="text-xl font-bold gradient-text mb-4">멤버 카드 미리보기</h4>
                        <p className="text-sm text-gray-400 mb-6">멤버 페이지에 표시될 카드 모양을 확인하세요.</p>
                        <MemberCardPreview settings={settings} profile={profile} />
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

const MemberCardPreview = ({ settings, profile }) => {
    const techStack = Array.isArray(profile.tech_stack) ? profile.tech_stack : [];
    const displayName = profile.name || '미등록';
    const bio = profile.self_description || '';
    const email = profile.email || '';
    const educationStatus = profile.education_status || '';
    const github = profile.github_username ? `https://github.com/${profile.github_username}` : '';
    const portfolio = profile.portfolio_link || '';
    const avatarInitial = displayName ? displayName[0].toUpperCase() : 'U';

    return (
        <div className="member-card p-6 rounded-xl text-center card-hover">
            <div className="img-container mx-auto">
                {profile.profile_image ? (
                    <img src={profile.profile_image} alt={displayName} />
                ) : (
                    <div className="w-28 h-28 rounded-full bg-gray-700 flex items-center justify-center text-xl text-white">
                        {avatarInitial}
                    </div>
                )}
            </div>
            <h3 className="text-xl font-bold mb-2 text-white">{displayName}</h3>
            <p className="text-blue-300 mb-4">{bio || '자기소개를 입력해주세요.'}</p>

            {settings.email && email && (
                <div className="mb-2 text-sm text-gray-300">
                    <i className="fas fa-envelope text-blue-400 mr-2"></i>{email}
                </div>
            )}
            {settings.career && educationStatus && (
                <div className="mb-4 text-sm text-gray-300">
                    <i className="fas fa-graduation-cap text-green-400 mr-2"></i>{educationStatus}
                </div>
            )}

            {settings.techstack && techStack.length > 0 && (
                <div className="mb-4">
                    {techStack.map((tag) => (
                        <span key={tag} className="tech-tag">{tag}</span>
                    ))}
                </div>
            )}

            <div className="flex justify-center space-x-4">
                {settings.github && github && (
                    <a href={github} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 text-xl">
                        <i className="fab fa-github"></i>
                    </a>
                )}
                {settings.portfolio && portfolio && (
                    <a href={portfolio} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-400 text-xl">
                        <i className="fas fa-link"></i>
                    </a>
                )}
            </div>
        </div>
    );
};

export default MyPageSettings;
