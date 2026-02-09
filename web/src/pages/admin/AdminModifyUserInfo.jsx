import React, { useState, useEffect, useCallback } from 'react';
import { formatBirthDate } from '../../utils/dateFormatter';
import defaultProfileImage from '../../logo.svg';

const InfoRow = ({ label, id, value, onChange, editable = true, type = 'text', options = null, ...props }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
        {options ? (
            <select
                id={id}
                value={value || ''}
                onChange={onChange}
                disabled={!editable}
                className={`form-input ${!editable ? 'bg-gray-700 cursor-not-allowed' : ''}`}
                {...props}
            >
                <option value="">선택</option>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        ) : (
            <input
                type={type}
                id={id}
                value={value || ''}
                onChange={onChange}
                readOnly={!editable}
                className={`form-input ${!editable ? 'bg-gray-700 cursor-not-allowed' : ''}`}
                {...props}
            />
        )}
    </div>
);

const AdminModifyUserInfo = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [formData, setFormData] = useState(null);
    const [saving, setSaving] = useState(false);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch('/api/v1/admin/members', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch members');
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const filteredUsers = users.filter(user => {
        const searchLower = search.toLowerCase();
        return (
            user.name?.toLowerCase().includes(searchLower) ||
            user.username?.toLowerCase().includes(searchLower) ||
            user.student_number?.includes(search) ||
            user.email?.toLowerCase().includes(searchLower)
        );
    });

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setFormData({ ...user });
    };

    const handleCloseModal = () => {
        setSelectedUser(null);
        setFormData(null);
    };

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData) return;

        setSaving(true);
        try {
            const token = localStorage.getItem('access_token');
            const updateData = {
                name: formData.name,
                student_number: formData.student_number,
                phone_number: formData.phone_number,
                email: formData.email,
                major: formData.major,
                join_year: formData.join_year ? Number(formData.join_year) : null,
                birth_date: formData.birth_date || null,
                gender: formData.gender || null,
                education_status: formData.education_status || null,
            };

            const res = await fetch(`/api/v1/admin/members/${formData.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });

            if (!res.ok) throw new Error('정보 수정에 실패했습니다');

            alert('사용자 정보가 수정되었습니다.');
            handleCloseModal();
            await fetchUsers();
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const getRoleDisplayName = (role) => {
        switch (role) {
            case 'ADMIN': return '관리자';
            case 'MEMBER': return '멤버';
            case 'GUEST': return '게스트';
            default: return role;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('ko-KR');
    };

    if (loading) {
        return (
            <div className="container mx-auto max-w-7xl p-6">
                <div className="text-center py-12">
                    <i className="fas fa-spinner fa-spin text-4xl text-blue-400 mb-4"></i>
                    <p className="text-gray-400">데이터를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto max-w-7xl p-6">
                <div className="text-center py-12">
                    <i className="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                    <p className="text-red-400">{error}</p>
                    <button onClick={fetchUsers} className="btn-primary mt-4">다시 시도</button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-7xl p-6">
            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">사용자 정보 수정</h3>
                <div className="widget-card p-6 rounded-xl">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">사용자 검색</label>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="이름, 아이디, 학번, 이메일로 검색..."
                            className="form-input w-full md:w-1/2"
                        />
                    </div>
                    <p className="text-sm text-gray-400">총 {filteredUsers.length}명의 사용자</p>
                </div>
            </section>

            <section className="mb-8">
                <div className="widget-card rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800">
                                <tr>
                                    <th className="p-4 text-left">프로필</th>
                                    <th className="p-4 text-left">이름/아이디</th>
                                    <th className="p-4 text-left">학번</th>
                                    <th className="p-4 text-left">이메일</th>
                                    <th className="p-4 text-left">권한</th>
                                    <th className="p-4 text-center">작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-gray-400">
                                            사용자가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map(user => (
                                        <tr key={user.id} className="table-row border-b border-gray-700 hover:bg-gray-800/50 cursor-pointer" onClick={() => handleSelectUser(user)}>
                                            <td className="p-4">
                                                <img
                                                    src={user.profile_image || defaultProfileImage}
                                                    alt={user.name}
                                                    className="w-10 h-10 rounded-full object-cover"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = defaultProfileImage;
                                                    }}
                                                />
                                            </td>
                                            <td className="p-4">
                                                <div className="font-semibold text-white">{user.name || '-'}</div>
                                                <div className="text-sm text-gray-400">@{user.username}</div>
                                            </td>
                                            <td className="p-4 text-gray-300">{user.student_number || '-'}</td>
                                            <td className="p-4 text-gray-300">{user.email || '-'}</td>
                                            <td className="p-4">
                                                <span className={`permission-badge permission-${user.role?.toLowerCase()}`}>
                                                    {getRoleDisplayName(user.role)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    className="btn-primary btn-small"
                                                    onClick={(e) => { e.stopPropagation(); handleSelectUser(user); }}
                                                >
                                                    <i className="fas fa-edit mr-1"></i>수정
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Edit Modal */}
            {selectedUser && formData && (
                <div className="modal show">
                    <div className="modal-content max-w-3xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold gradient-text">
                                {selectedUser.name || selectedUser.username}님 정보 수정
                            </h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-white">
                                <i className="fas fa-times text-xl"></i>
                            </button>
                        </div>

                        <form onSubmit={handleFormSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <InfoRow
                                    label="아이디 (변경 불가)"
                                    id="username"
                                    value={formData.username}
                                    editable={false}
                                />
                                <InfoRow
                                    label="이름"
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => handleFormChange('name', e.target.value)}
                                />
                                <InfoRow
                                    label="학번"
                                    id="student_number"
                                    value={formData.student_number}
                                    onChange={(e) => handleFormChange('student_number', e.target.value)}
                                />
                                <InfoRow
                                    label="이메일"
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleFormChange('email', e.target.value)}
                                />
                                <InfoRow
                                    label="전화번호"
                                    id="phone_number"
                                    value={formData.phone_number}
                                    onChange={(e) => handleFormChange('phone_number', e.target.value)}
                                />
                                <InfoRow
                                    label="전공"
                                    id="major"
                                    value={formData.major}
                                    onChange={(e) => handleFormChange('major', e.target.value)}
                                />
                                <InfoRow
                                    label="가입 연도"
                                    id="join_year"
                                    type="number"
                                    value={formData.join_year}
                                    onChange={(e) => handleFormChange('join_year', e.target.value)}
                                />
                                <InfoRow
                                    label="생년월일"
                                    id="birth_date"
                                    type="text"
                                    value={formData.birth_date ? formData.birth_date.split('T')[0].replace(/-/g, '.').replace(/\//g, '.') : ''}
                                    onChange={(e) => {
                                        const val = formatBirthDate(e.target.value);
                                        handleFormChange('birth_date', val);
                                    }}
                                    placeholder="YYYY.MM.DD"
                                    maxLength={10}
                                />
                                <InfoRow
                                    label="성별"
                                    id="gender"
                                    value={formData.gender}
                                    onChange={(e) => handleFormChange('gender', e.target.value)}
                                    options={[
                                        { value: 'Male', label: '남성' },
                                        { value: 'Female', label: '여성' }
                                    ]}
                                />
                                <InfoRow
                                    label="학적 상태"
                                    id="education_status"
                                    value={formData.education_status}
                                    onChange={(e) => handleFormChange('education_status', e.target.value)}
                                    options={[
                                        { value: '재학', label: '재학' },
                                        { value: '휴학', label: '휴학' },
                                        { value: '졸업', label: '졸업' }
                                    ]}
                                />
                            </div>

                            <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-700">
                                <button type="button" onClick={handleCloseModal} className="btn-secondary" disabled={saving}>
                                    취소
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                                    변경사항 저장
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminModifyUserInfo;