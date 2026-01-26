import React, { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '../../api/client';

const MyPageAccountSettings = () => {
    const [formData, setFormData] = useState({
        name: '',
        birthday: '',
        phone: '',
        email: ''
    });
    const [initialData, setInitialData] = useState({});
    const [isDirty, setIsDirty] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchAccountData();
    }, []);

    const fetchAccountData = async () => {
        try {
            setLoading(true);
            const data = await apiGet('/api/v1/mypage/account');

            // 날짜 포맷 변환 (YYYY-MM-DDT... -> YYYY-MM-DD)
            const birthDate = data.birth_date ? data.birth_date.split('T')[0] : '';

            const accountData = {
                name: data.name || '',
                birthday: birthDate,
                phone: data.phone_number || '',
                email: data.email || ''
            };

            setFormData(accountData);
            setInitialData(accountData);
        } catch (err) {
            console.error('계정 정보 로딩 실패:', err);
            setError('계정 정보를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setIsDirty(JSON.stringify(formData) !== JSON.stringify(initialData));
    }, [formData, initialData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isDirty) return;

        try {
            const updateData = {
                phone_number: formData.phone,
                // 이메일, 이름, 생일은 수정 가능한지 백엔드 DTO 확인 필요
                // 현재 UI상으로는 수정 가능하지만 백엔드 로직에 따라 다름
                // DTO: UpdateAccountDto에는 phone_number, email만 있을 수 있음.
                // 일단 모두 보내보거나, 기획에 따라 phone_number만 보낼 수도 있음.
                // 여기서는 phone_number, email을 보낸다고 가정 (email 수정은 보통 인증 필요하지만)
                email: formData.email
            };

            await apiPatch('/api/v1/mypage/account', updateData);
            alert('저장되었습니다!');
            setInitialData(formData);
            // 최신 데이터 다시 받아오기
            fetchAccountData();
        } catch (err) {
            console.error('계정 정보 수정 실패:', err);
            alert('정보 수정에 실패했습니다: ' + err.message);
        }
    };

    if (loading) return <div className="text-center py-10 text-white">Loading...</div>;
    if (error) return <div className="text-center py-10 text-red-500">{error}</div>;

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
                            <label htmlFor="name" className="label">이름 (변경 불가)</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                className="input opacity-50 cursor-not-allowed"
                                value={formData.name}
                                readOnly
                            />
                        </div>
                        <div>
                            <label htmlFor="birthday" className="label">생일 (변경 불가)</label>
                            <input
                                id="birthday"
                                name="birthday"
                                type="date"
                                className="input opacity-50 cursor-not-allowed"
                                value={formData.birthday}
                                readOnly
                            />
                        </div>
                    </div>
                </section>

                <hr className="my-6 border-gray-700" />

                <section aria-labelledby="sec-contacts">
                    <h4 id="sec-contacts" className="text-lg font-bold mb-4">연락처</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label htmlFor="phone" className="label">휴대전화</label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                className="input"
                                value={formData.phone}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="label">이메일</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                className="input"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                    </div>
                    <div className="mt-4">
                        <button type="button" onClick={() => setIsModalOpen(true)} className="px-4 py-2 rounded-lg btn-outline hover:bg-gray-800">
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
    const [pwData, setPwData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setPwData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (pwData.newPassword !== pwData.confirmPassword) {
            alert('새 비밀번호가 일치하지 않습니다.');
            return;
        }

        try {
            await apiPatch('/api/v1/mypage/account/password', {
                current_password: pwData.currentPassword,
                new_password: pwData.newPassword
            });
            alert('비밀번호가 변경되었습니다. 다시 로그인해주세요.');
            onClose();
            // 로그아웃 처리 등을 할 수도 있음
        } catch (err) {
            console.error('비밀번호 변경 실패:', err);
            alert('비밀번호 변경에 실패했습니다: ' + err.message);
        }
    };

    return (
        <div className="modal show">
            <div className="modal-panel">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold">비밀번호 변경</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl"><i className="fas fa-times"></i></button>
                </div>
                <p className="text-sm text-gray-400 mb-4">새로운 비밀번호를 입력해주세요.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="pw-current" className="label">현재 비밀번호</label>
                        <input
                            id="pw-current"
                            name="currentPassword"
                            type="password"
                            className="input"
                            value={pwData.currentPassword}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="pw-new" className="label">새 비밀번호</label>
                        <input
                            id="pw-new"
                            name="newPassword"
                            type="password"
                            className="input"
                            value={pwData.newPassword}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="pw-confirm" className="label">새 비밀번호 확인</label>
                        <input
                            id="pw-confirm"
                            name="confirmPassword"
                            type="password"
                            className="input"
                            value={pwData.confirmPassword}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="flex items-center justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg btn-outline hover:bg-gray-800">취소</button>
                        <button type="submit" className="px-4 py-2 rounded-lg btn-primary">변경</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MyPageAccountSettings;