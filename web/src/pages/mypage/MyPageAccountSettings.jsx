import React, { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '../../api/client';

const MyPageAccountSettings = () => {
    const [formData, setFormData] = useState({ name: '', birthday: '', phone: '', email: '' });
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
                    name: data.name || '',
                    birthday: data.birthday || '',
                    phone: data.phone_number || '',
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

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isDirty) return;

        try {
            const updateData = {
                name: formData.name,
                birthday: formData.birthday,
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
            <h3 className="text-2xl font-bold gradient-text mb-6">개인정보 수정</h3>
            <form onSubmit={handleSubmit} className="widget-card rounded-xl p-6" noValidate>
                <section aria-labelledby="sec-profile">
                    <h4 id="sec-profile" className="text-lg font-bold mb-4 text-center">프로필</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label htmlFor="name" className="form-label">이름</label>
                            <input id="name" name="name" type="text" className="form-input" value={formData.name} onChange={handleInputChange} required />
                        </div>
                        <div>
                            <label htmlFor="birthday" className="form-label">생일</label>
                            <input id="birthday" name="birthday" type="date" className="form-input" value={formData.birthday} onChange={handleInputChange} required />
                        </div>
                    </div>
                </section>

                <hr className="my-6 border-gray-700" />

                <section aria-labelledby="sec-contacts">
                    <h4 id="sec-contacts" className="text-lg font-bold mb-4 text-center">연락처</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label htmlFor="phone" className="form-label">휴대전화</label>
                            <input id="phone" name="phone" type="tel" className="form-input" value={formData.phone} onChange={handleInputChange} required />
                        </div>
                        <div>
                            <label htmlFor="email" className="form-label">이메일</label>
                            <input id="email" name="email" type="email" className="form-input" value={formData.email} onChange={handleInputChange} required />
                        </div>
                    </div>
                    <div className="mt-4">
                        <button type="button" onClick={() => setIsModalOpen(true)} className="px-4 py-2 rounded-lg btn-secondary hover:bg-gray-800">
                            <i className="fa-solid fa-key mr-2"></i>비밀번호 변경
                        </button>
                    </div>
                </section>

                <hr className="my-6 border-gray-700" />

                <div className="flex items-center justify-end gap-3">
                    <button type="submit" className={`px-5 py-2 rounded-lg btn-primary ${!isDirty && 'opacity-50'}`} disabled={!isDirty}>저장</button>
                </div>
            </form>
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

    if (!isOpen) return null;

    const handlePasswordChange = (e) => {
        const { id, value } = e.target;
        const field = id.replace('pw-', '').replace('-', '');
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
                newPassword: passwordData.newPassword
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
        <div className="modal active">
            <div className="modal-content p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">비밀번호 변경</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl"><i className="fas fa-times"></i></button>
                </div>
                <p className="text-sm text-gray-400 mb-4">아래 순서대로 입력 후 변경을 완료하세요.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="pw-current" className="form-label">현재 비밀번호</label>
                        <input
                            id="pw-current"
                            type="password"
                            className="form-input"
                            value={passwordData.currentPassword}
                            onChange={handlePasswordChange}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="pw-new" className="form-label">새 비밀번호</label>
                        <input
                            id="pw-new"
                            type="password"
                            className="form-input"
                            value={passwordData.newPassword}
                            onChange={handlePasswordChange}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="pw-confirm" className="form-label">새 비밀번호 확인</label>
                        <input
                            id="pw-confirm"
                            type="password"
                            className="form-input"
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordChange}
                            required
                        />
                    </div>
                    <div>
                        <div className="flex items-end gap-3">
                            <div className="flex-1">
                                <label htmlFor="pw-code" className="form-label">인증 코드</label>
                                <input id="pw-code" type="text" className="form-input" required />
                            </div>
                            <button type="button" className="px-3 py-2 rounded-lg btn-secondary hover:bg-gray-800">코드 전송</button>
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg btn-secondary hover:bg-gray-800">취소</button>
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