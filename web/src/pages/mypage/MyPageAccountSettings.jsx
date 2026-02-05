import React, { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '../../api/client';

const MyPageAccountSettings = () => {
    const [formData, setFormData] = useState({ username: '', name: '', phone: '', email: '' });
    const [initialData, setInitialData] = useState({});
    const [isDirty, setIsDirty] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAccountData = async () => {
            try {
                setLoading(true);
                const data = await apiGet('/api/v1/mypage/account');
                const accountData = {
                    username: data.username || '', // Added
                    name: data.name || '',
                    phone: data.phoneNumber || data.phone_number || '',
                    email: data.email || ''
                };
                setFormData(accountData);
                setInitialData(accountData);
            } catch (err) {
                console.error('Failed to fetch account data:', err);
                alert('계정 정보를 불러오는데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        };

        fetchAccountData();
    }, []);

    useEffect(() => {
        setIsDirty(JSON.stringify(formData) !== JSON.stringify(initialData));
    }, [formData, initialData]);

    // 전화번호 자동 형식화 함수
    const formatPhoneNumber = (value) => {
        const numbers = value.replace(/[^0-9]/g, '');
        const limited = numbers.slice(0, 11);
        if (limited.startsWith('02')) {
            if (limited.length <= 2) return limited;
            if (limited.length <= 5) return `${limited.slice(0, 2)}-${limited.slice(2)}`;
            if (limited.length <= 9) return `${limited.slice(0, 2)}-${limited.slice(2, 5)}-${limited.slice(5)}`;
            return `${limited.slice(0, 2)}-${limited.slice(2, 6)}-${limited.slice(6, 10)}`;
        }
        if (limited.length <= 3) return limited;
        if (limited.length <= 6) return `${limited.slice(0, 3)}-${limited.slice(3)}`;
        if (limited.length <= 10) return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
        return `${limited.slice(0, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`;
    };

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        if (id === 'phone') {
            setFormData(prev => ({ ...prev, [id]: formatPhoneNumber(value) }));
        } else {
            setFormData(prev => ({ ...prev, [id]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isDirty) return;

        try {
            const updateData = {
                name: formData.name,
                phone_number: formData.phone,
                email: formData.email
            };
            await apiPatch('/api/v1/mypage/account', updateData);
            alert('저장되었습니다!');
            setInitialData(formData);
        } catch (err) {
            console.error('Failed to update account:', err);
            alert('저장에 실패했습니다: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto max-w-4xl p-6">
                <div className="text-center text-gray-400">계정 정보를 불러오는 중...</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-4xl">
            <h3 className="text-2xl font-bold gradient-text mb-6">계정 정보 수정</h3>
            <form onSubmit={handleSubmit} className="widget-card rounded-xl p-6" noValidate>
                <section aria-labelledby="sec-profile">
                    <div className="flex items-center justify-between mb-4">
                        <h4 id="sec-profile" className="text-lg font-bold">프로필</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label htmlFor="username" className="label">아이디</label>
                            <input id="username" name="username" type="text" className="input bg-gray-700 text-gray-400 cursor-not-allowed" value={formData.username} readOnly disabled />
                        </div>
                        <div>
                            <label htmlFor="name" className="label">이름</label>
                            <input id="name" name="name" type="text" className="input" value={formData.name} onChange={handleInputChange} required />
                        </div>
                    </div>
                </section>

                <hr className="my-6 border-gray-700" />

                <section aria-labelledby="sec-contacts">
                    <h4 id="sec-contacts" className="text-lg font-bold mb-4">연락처</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label htmlFor="phone" className="label">전화번호</label>
                            <input id="phone" name="phone" type="tel" className="input" value={formData.phone} onChange={handleInputChange} required />
                        </div>
                        <div>
                            <label htmlFor="email" className="label">이메일</label>
                            <input id="email" name="email" type="email" className="input" value={formData.email} onChange={handleInputChange} required />
                        </div>
                    </div>

                </section>

                <hr className="my-6 border-gray-700" />

                <div className="flex items-center justify-end gap-3">
                    <button type="submit" className={`px-5 py-2 rounded-lg btn-primary ${!isDirty && 'opacity-50'}`} disabled={!isDirty}>저장</button>
                </div>
            </form>

            <div className="mt-6 flex justify-end">
                <button type="button" onClick={() => setIsModalOpen(true)} className="px-4 py-2 rounded-lg btn-outline text-red-400 hover:bg-red-400/10 border-red-400">
                    <i className="fa-solid fa-key mr-2"></i>비밀번호 변경
                </button>
            </div>
            <PasswordChangeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};

const PasswordChangeModal = ({ isOpen, onClose }) => {
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        verificationCode: ''
    });
    const [submitting, setSubmitting] = useState(false);

    // Password strength state
    const [passwordStrength, setPasswordStrength] = useState({
        minLength: false,
        hasLowercase: false,
        hasUppercase: false,
        hasNumber: false,
        hasSpecial: false,
    });
    const [passwordMatch, setPasswordMatch] = useState(null);

    // Password validation logic
    useEffect(() => {
        const password = passwordData.newPassword;
        setPasswordStrength({
            minLength: password.length >= 8,
            hasLowercase: /[a-z]/.test(password),
            hasUppercase: /[A-Z]/.test(password),
            hasNumber: /\d/.test(password),
            hasSpecial: /[@$!%*?&]/.test(password),
        });
    }, [passwordData.newPassword]);

    // Password match logic
    useEffect(() => {
        if (passwordData.confirmPassword.length === 0) {
            setPasswordMatch(null);
            return;
        }
        setPasswordMatch(passwordData.newPassword === passwordData.confirmPassword);
    }, [passwordData.newPassword, passwordData.confirmPassword]);

    if (!isOpen) return null;

    const handlePasswordChange = (e) => {
        const { id, value } = e.target;
        // pw-current -> currentPassword, pw-new -> newPassword, pw-confirm -> confirmPassword
        const field = id.replace('pw-', '') + 'Password';
        setPasswordData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            alert('새 비밀번호가 일치하지 않습니다.');
            return;
        }

        if (passwordData.newPassword.length < 8) {
            alert('비밀번호는 최소 8자 이상이어야 합니다.');
            return;
        }

        try {
            setSubmitting(true);
            await apiPatch('/api/v1/mypage/account/password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
                confirmPassword: passwordData.confirmPassword
            });
            alert('비밀번호가 변경되었습니다.');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '', verificationCode: '' });
            onClose();
        } catch (err) {
            console.error('Password change failed:', err);
            alert('비밀번호 변경에 실패했습니다: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal show">
            <div className="modal-panel">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold">비밀번호 변경</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl"><i className="fas fa-times"></i></button>
                </div>
                <p className="text-sm text-gray-400 mb-4">아래 순서대로 입력 후 변경을 완료하세요.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="pw-current" className="label">현재 비밀번호</label>
                        <input
                            id="pw-current"
                            type="password"
                            className="input"
                            value={passwordData.currentPassword}
                            onChange={handlePasswordChange}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="pw-new" className="label">새 비밀번호</label>
                        <input
                            id="pw-new"
                            type="password"
                            className="input"
                            value={passwordData.newPassword}
                            onChange={handlePasswordChange}
                            required
                        />
                        {/* Password Strength Indicators */}
                        {passwordData.newPassword.length > 0 && (
                            <div className="mt-2 space-y-1 text-left text-sm">
                                <div className={passwordStrength.minLength ? 'text-green-400' : 'text-red-400'}>
                                    <i className={`fas ${passwordStrength.minLength ? 'fa-check' : 'fa-times'} mr-2`}></i>
                                    8자 이상
                                </div>
                                <div className={passwordStrength.hasLowercase ? 'text-green-400' : 'text-red-400'}>
                                    <i className={`fas ${passwordStrength.hasLowercase ? 'fa-check' : 'fa-times'} mr-2`}></i>
                                    영문 소문자 포함
                                </div>
                                <div className={passwordStrength.hasUppercase ? 'text-green-400' : 'text-red-400'}>
                                    <i className={`fas ${passwordStrength.hasUppercase ? 'fa-check' : 'fa-times'} mr-2`}></i>
                                    영문 대문자 포함
                                </div>
                                <div className={passwordStrength.hasNumber ? 'text-green-400' : 'text-red-400'}>
                                    <i className={`fas ${passwordStrength.hasNumber ? 'fa-check' : 'fa-times'} mr-2`}></i>
                                    숫자 포함
                                </div>
                                <div className={passwordStrength.hasSpecial ? 'text-green-400' : 'text-red-400'}>
                                    <i className={`fas ${passwordStrength.hasSpecial ? 'fa-check' : 'fa-times'} mr-2`}></i>
                                    특수문자 포함 (@$!%*?&)
                                </div>
                            </div>
                        )}
                        <div className="strength-rail mt-2"><div className="strength-bar"></div></div>
                    </div>
                    <div>
                        <label htmlFor="pw-confirm" className="label">새 비밀번호 확인</label>
                        <input
                            id="pw-confirm"
                            type="password"
                            className="input"
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordChange}
                            required
                        />
                        {passwordMatch !== null && (
                            <div className={`text-sm mt-1 text-left ${passwordMatch ? 'text-green-400' : 'text-red-500'}`}>
                                <i className={`fas ${passwordMatch ? 'fa-check' : 'fa-times'} mr-2`}></i>
                                {passwordMatch ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
                            </div>
                        )}
                    </div>
                    <div>

                    </div>
                    <div className="flex items-center justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg btn-outline hover:bg-gray-800">취소</button>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-lg btn-primary"
                            disabled={submitting}
                        >
                            {submitting ? '변경 중...' : '변경'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MyPageAccountSettings;