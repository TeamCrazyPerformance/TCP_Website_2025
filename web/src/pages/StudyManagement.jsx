import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiGet, apiPost } from '../api/client';

export default function StudyManagement() {
    const { id } = useParams();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [study, setStudy] = useState(null);
    const [members, setMembers] = useState([]);
    const [pendingMembers, setPendingMembers] = useState([]);
    const [leaderNominees, setLeaderNominees] = useState([]);
    const [progress, setProgress] = useState([]);
    const [resources, setResources] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [activeTab, setActiveTab] = useState('info');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState(null);

    // Edit mode states
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [editingProgressId, setEditingProgressId] = useState(null);
    const [editProgressForm, setEditProgressForm] = useState({ title: '', content: '' });

    // Search member state
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        const user = localStorage.getItem('auth_user');
        const currentUser = user ? JSON.parse(user) : null;

        if (!token || !currentUser) {
            setIsLoading(false);
            setErrorMessage('로그인이 필요합니다.');
            return;
        }

        const fetchData = async () => {
            try {
                setIsLoading(true);
                const data = await apiGet(`/api/v1/study/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                // Check authorization: must be leader or admin
                // Multi-leader support: Check if current user is in the members list with LEADER role
                const currentMember = (data.members || []).find(m => m.user_id === currentUser.id);
                const isLeader = currentMember?.role === 'LEADER';
                const isAdmin = currentUser.role === 'ADMIN';

                if (!isLeader && !isAdmin) {
                    setErrorMessage('스터디장 또는 관리자만 접근할 수 있습니다.');
                    setIsLoading(false);
                    return;
                }

                setIsAuthorized(true);
                setIsAdmin(isAdmin);
                setCurrentUserRole(isLeader ? 'LEADER' : (isAdmin ? 'ADMIN' : null));
                setStudy(data);
                setEditForm({
                    study_name: data.study_name || '',
                    start_year: data.start_year || new Date().getFullYear(),
                    study_description: data.study_description || '',
                    tag: data.tag || '',
                    recruit_count: data.recruit_count || 0,
                    period: data.period || '',
                    apply_deadline: data.apply_deadline?.split('T')[0] || '',
                    place: data.place || '',
                    way: data.way || '',
                });

                // Separate PENDING, MEMBER, LEADER_NOMINEE
                // Note: Leaders are also in the members list but usually displayed separately or at top.
                // For "Current Members" list, we might want to exclude the current user if they are leader?
                // Or just show everyone. Let's show everyone except LEADER_NOMINEE and PENDING in the "Current Members" list.
                // Actually, let's keep it simple:
                // Members Tab: Shows LEADER and MEMBER.
                // Nominees Section: Shows LEADER_NOMINEE.
                // Pending Tab: Shows PENDING.

                const approved = (data.members || []).filter(m => m.role === 'MEMBER' || m.role === 'LEADER');
                const pending = (data.members || []).filter(m => m.role === 'PENDING');
                const nominees = (data.members || []).filter(m => m.role === 'NOMINEE');

                setMembers(approved);
                setPendingMembers(pending);
                setLeaderNominees(nominees);
                setProgress(data.progress || []);
                setResources(data.resources || []);
            } catch (error) {
                setErrorMessage(error.message || '스터디 정보를 불러오지 못했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const token = localStorage.getItem('access_token');

    // Update study info
    const handleUpdateInfo = async (e) => {
        e.preventDefault();
        try {
            await fetch(`/api/v1/study/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(editForm),
            });
            alert('스터디 정보가 수정되었습니다.');
            setIsEditingInfo(false);
            window.location.reload();
        } catch (error) {
            alert(error.message || '수정에 실패했습니다.');
        }
    };

    // Approve pending member
    const handleApproveMember = async (userId) => {
        try {
            const response = await fetch(`/api/v1/study/${id}/members/${userId}/approve`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '승인에 실패했습니다.');
            }

            alert('멤버가 승인되었습니다.');
            window.location.reload();
        } catch (error) {
            alert(error.message || '승인에 실패했습니다.');
        }
    };

    // Reject/Remove member
    const handleRemoveMember = async (userId, isPending = false) => {
        const confirmMsg = isPending ? '이 신청을 거절하시겠습니까?' : '이 멤버를 추방하시겠습니까?';
        if (!window.confirm(confirmMsg)) return;
        try {
            await fetch(`/api/v1/study/${id}/members/${userId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            alert(isPending ? '신청이 거절되었습니다.' : '멤버가 추방되었습니다.');
            window.location.reload();
        } catch (error) {
            alert(error.message || '작업에 실패했습니다.');
        }
    };

    // Nominate Leader
    const handleNominateLeader = async (userId) => {
        if (!window.confirm('이 멤버를 스터디장으로 지명하시겠습니까? 멤버가 수락하면 스터디장이 됩니다.')) return;
        try {
            await apiPost(`/api/v1/study/${id}/members/${userId}/nominate`);
            alert('스터디장 지명이 완료되었습니다. 멤버가 수락하면 권한이 부여됩니다.');
            window.location.reload();
        } catch (error) {
            alert(error.message || '지명에 실패했습니다.');
        }
    };

    // Leave Study (Leader)
    const handleLeaveStudy = async () => {
        if (!window.confirm('정말로 스터디를 탈퇴하시겠습니까? 다른 스터디장이 최소 1명 이상 있어야 가능합니다.')) return;
        try {
            await fetch(`/api/v1/study/${id}/leave`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            alert('스터디를 성공적으로 탈퇴했습니다.');
            navigate('/study');
        } catch (error) {
            alert(error.message || '탈퇴에 실패했습니다. 다른 스터디장이 있는지 확인해주세요.');
        }
    };

    // Update progress
    const handleUpdateProgress = async (progressId) => {
        try {
            await fetch(`/api/v1/study/${id}/progress/${progressId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(editProgressForm),
            });
            alert('진행사항이 수정되었습니다.');
            setEditingProgressId(null);
            window.location.reload();
        } catch (error) {
            alert(error.message || '수정에 실패했습니다.');
        }
    };

    // Delete progress
    const handleDeleteProgress = async (progressId) => {
        if (!window.confirm('이 진행사항을 삭제하시겠습니까?')) return;
        try {
            await fetch(`/api/v1/study/${id}/progress/${progressId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            alert('진행사항이 삭제되었습니다.');
            window.location.reload();
        } catch (error) {
            alert(error.message || '삭제에 실패했습니다.');
        }
    };

    // Delete resource
    const handleDeleteResource = async (resourceId) => {
        if (!window.confirm('이 자료를 삭제하시겠습니까?')) return;
        try {
            await fetch(`/api/v1/study/${id}/resources/${resourceId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            alert('자료가 삭제되었습니다.');
            window.location.reload();
        } catch (error) {
            alert(error.message || '삭제에 실패했습니다.');
        }
    };

    // Search available members
    const handleSearchMembers = async () => {
        if (!searchKeyword.trim()) return;
        try {
            setIsSearching(true);
            const response = await fetch(`/api/v1/study/${id}/available-members?search=${encodeURIComponent(searchKeyword)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            setSearchResults(data || []);
        } catch (error) {
            alert(error.message || '검색에 실패했습니다.');
        } finally {
            setIsSearching(false);
        }
    };

    // Add member directly
    const handleAddMember = async (userId) => {
        try {
            await fetch(`/api/v1/study/${id}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ user_id: userId, role: 'MEMBER' }),
            });
            alert('멤버가 추가되었습니다.');
            setSearchResults([]);
            setSearchKeyword('');
            window.location.reload();
        } catch (error) {
            alert(error.message || '추가에 실패했습니다.');
        }
    };

    // Delete study (Admin only)
    const handleDeleteStudy = async () => {
        if (!window.confirm('정말로 이 스터디를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        try {
            const response = await fetch(`/api/v1/study/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '삭제 실패');
            }
            alert('스터디가 삭제되었습니다.');
            navigate('/study');
        } catch (error) {
            alert(error.message || '스터디 삭제에 실패했습니다.');
        }
    };

    if (isLoading) {
        return <div className="container mx-auto px-4 py-24 text-center">로딩 중...</div>;
    }

    if (errorMessage || !isAuthorized) {
        return (
            <div className="container mx-auto px-4 py-24 text-center text-gray-400">
                <p className="mb-6">{errorMessage}</p>
                <Link to="/study" className="back-button inline-flex items-center px-8 py-4 rounded-lg text-lg font-medium">
                    스터디 목록으로
                </Link>
            </div>
        );
    }

    const tabs = [
        { key: 'info', label: '기본 정보', icon: 'fa-info-circle' },
        { key: 'members', label: '멤버 관리', icon: 'fa-users' },
        { key: 'pending', label: `승인 대기 (${pendingMembers.length})`, icon: 'fa-user-clock' },
        { key: 'progress', label: '진행사항', icon: 'fa-tasks' },
        { key: 'resources', label: '자료 관리', icon: 'fa-folder' },
    ];

    return (
        <main className="container mx-auto px-4 py-24">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link to={`/study/${id}`} className="text-accent-blue hover:underline mb-4 inline-block">
                        <i className="fas fa-arrow-left mr-2"></i>스터디로 돌아가기
                    </Link>
                    <div className="flex justify-between items-center">
                        <h1 className="orbitron text-3xl md:text-4xl font-bold gradient-text">
                            스터디 관리: {study?.study_name}
                        </h1>
                        <div className="flex gap-2">
                            {currentUserRole === 'LEADER' && (
                                <button
                                    onClick={handleLeaveStudy}
                                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                                >
                                    <i className="fas fa-sign-out-alt mr-2"></i>스터디 탈퇴
                                </button>
                            )}
                            {isAdmin && (
                                <button
                                    onClick={handleDeleteStudy}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                                >
                                    <i className="fas fa-trash mr-2"></i>스터디 삭제
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-700 pb-4">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.key
                                ? 'bg-accent-blue text-white'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                }`}
                        >
                            <i className={`fas ${tab.icon} mr-2`}></i>{tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    {/* Basic Info Tab */}
                    {activeTab === 'info' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">기본 정보</h2>
                                <button
                                    onClick={() => setIsEditingInfo(!isEditingInfo)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                                >
                                    {isEditingInfo ? '취소' : '수정'}
                                </button>
                            </div>
                            {isEditingInfo ? (
                                <form onSubmit={handleUpdateInfo} className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-gray-300 mb-2">스터디명</label>
                                            <input
                                                type="text"
                                                value={editForm.study_name}
                                                onChange={(e) => setEditForm({ ...editForm, study_name: e.target.value })}
                                                className="w-full bg-gray-800 rounded-lg py-2 px-4 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-300 mb-2">시작 연도</label>
                                            <input
                                                type="number"
                                                value={editForm.start_year}
                                                onChange={(e) => setEditForm({ ...editForm, start_year: parseInt(e.target.value) })}
                                                className="w-full bg-gray-800 rounded-lg py-2 px-4 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-300 mb-2">모집 인원</label>
                                            <input
                                                type="number"
                                                value={editForm.recruit_count}
                                                onChange={(e) => setEditForm({ ...editForm, recruit_count: parseInt(e.target.value) })}
                                                className="w-full bg-gray-800 rounded-lg py-2 px-4 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-300 mb-2">기간</label>
                                            <input
                                                type="text"
                                                value={editForm.period}
                                                onChange={(e) => setEditForm({ ...editForm, period: e.target.value })}
                                                className="w-full bg-gray-800 rounded-lg py-2 px-4 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-300 mb-2">진행 방식</label>
                                            <input
                                                type="text"
                                                value={editForm.way}
                                                onChange={(e) => setEditForm({ ...editForm, way: e.target.value })}
                                                className="w-full bg-gray-800 rounded-lg py-2 px-4 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-300 mb-2">장소</label>
                                            <input
                                                type="text"
                                                value={editForm.place}
                                                onChange={(e) => setEditForm({ ...editForm, place: e.target.value })}
                                                className="w-full bg-gray-800 rounded-lg py-2 px-4 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-300 mb-2">모집 마감일</label>
                                            <input
                                                type="date"
                                                value={editForm.apply_deadline}
                                                onChange={(e) => setEditForm({ ...editForm, apply_deadline: e.target.value })}
                                                className="w-full bg-gray-800 rounded-lg py-2 px-4 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-300 mb-2">태그</label>
                                            <input
                                                type="text"
                                                value={editForm.tag}
                                                onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
                                                className="w-full bg-gray-800 rounded-lg py-2 px-4 text-white"
                                                placeholder="쉼표로 구분"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-gray-300 mb-2">소개</label>
                                        <textarea
                                            value={editForm.study_description}
                                            onChange={(e) => setEditForm({ ...editForm, study_description: e.target.value })}
                                            rows="4"
                                            className="w-full bg-gray-800 rounded-lg py-2 px-4 text-white"
                                        ></textarea>
                                    </div>
                                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg">
                                        저장하기
                                    </button>
                                </form>
                            ) : (
                                <div className="grid md:grid-cols-2 gap-4 text-gray-300">
                                    <p><strong className="text-white">스터디명:</strong> {study?.study_name}</p>
                                    <p><strong className="text-white">시작 연도:</strong> {study?.start_year}</p>
                                    <p><strong className="text-white">모집 인원:</strong> {study?.recruit_count}명</p>
                                    <p><strong className="text-white">기간:</strong> {study?.period || '-'}</p>
                                    <p><strong className="text-white">진행 방식:</strong> {study?.way || '-'}</p>
                                    <p><strong className="text-white">장소:</strong> {study?.place || '-'}</p>
                                    <p><strong className="text-white">모집 마감일:</strong> {study?.apply_deadline?.split('T')[0] || '-'}</p>
                                    <p><strong className="text-white">태그:</strong> {study?.tag || '-'}</p>
                                    <div className="md:col-span-2">
                                        <strong className="text-white">소개:</strong>
                                        <p className="mt-2">{study?.study_description || '-'}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Members Tab */}
                    {activeTab === 'members' && (
                        <div>
                            <h2 className="text-xl font-bold text-white mb-6">멤버 관리</h2>

                            {/* Search & Add */}
                            <div className="mb-6 bg-gray-800 p-4 rounded-lg">
                                <h3 className="font-semibold text-white mb-3">멤버 직접 추가</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={searchKeyword}
                                        onChange={(e) => setSearchKeyword(e.target.value)}
                                        placeholder="이름 또는 이메일로 검색"
                                        className="flex-1 bg-gray-700 rounded-lg py-2 px-4 text-white"
                                    />
                                    <button
                                        onClick={handleSearchMembers}
                                        disabled={isSearching}
                                        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                                    >
                                        {isSearching ? '검색 중...' : '검색'}
                                    </button>
                                </div>
                                {searchResults.length > 0 && (
                                    <ul className="mt-4 space-y-2">
                                        {searchResults.map((user) => (
                                            <li key={user.user_id} className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                                                <span className="text-white">{user.name} ({user.email})</span>
                                                <button
                                                    onClick={() => handleAddMember(user.user_id)}
                                                    className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm"
                                                >
                                                    추가
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Current Members */}
                            <h3 className="font-semibold text-white mb-3">현재 멤버 ({members.length}명)</h3>
                            {/* Tips for management */}
                            <p className="text-sm text-gray-400 mb-4">
                                <i className="fas fa-info-circle mr-1"></i>
                                리더 지명은 'MEMBER' 등급의 사용자만 가능합니다. (이미 리더인 사용자는 제외)
                            </p>

                            {members.length > 0 ? (
                                <ul className="space-y-2 mb-6">
                                    {members.map((member) => (
                                        <li key={member.user_id} className="flex justify-between items-center bg-gray-800 p-4 rounded-lg">
                                            <span className="text-white">
                                                {member.name}
                                                <span className={`ml-2 text-xs px-2 py-0.5 rounded ${member.role === 'LEADER' ? 'bg-yellow-600 text-white' : 'bg-gray-600'}`}>
                                                    {member.role}
                                                </span>
                                            </span>
                                            <div className="flex gap-2">
                                                {member.role === 'MEMBER' && (
                                                    <button
                                                        onClick={() => handleNominateLeader(member.user_id)}
                                                        className="text-yellow-400 hover:text-yellow-300 mr-2"
                                                    >
                                                        <i className="fas fa-crown mr-1"></i>리더 지명
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleRemoveMember(member.user_id)}
                                                    className="text-red-500 hover:text-red-400"
                                                >
                                                    <i className="fas fa-user-minus mr-1"></i>추방
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-400 mb-6">아직 멤버가 없습니다.</p>
                            )}

                            {/* Leader Nominees */}
                            {leaderNominees.length > 0 && (
                                <>
                                    <h3 className="font-semibold text-white mb-3">리더 지명 대기 ({leaderNominees.length}명)</h3>
                                    <ul className="space-y-2 mb-6">
                                        {leaderNominees.map((member) => (
                                            <li key={member.user_id} className="flex justify-between items-center bg-gray-800 p-4 rounded-lg border border-yellow-600">
                                                <span className="text-white">{member.name} (수락 대기중)</span>
                                                <button
                                                    onClick={() => handleRemoveMember(member.user_id)}
                                                    className="text-red-500 hover:text-red-400"
                                                >
                                                    <i className="fas fa-times mr-1"></i>지명 취소 (추방)
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    )}

                    {/* Pending Tab */}
                    {activeTab === 'pending' && (
                        <div>
                            <h2 className="text-xl font-bold text-white mb-6">승인 대기 ({pendingMembers.length}명)</h2>
                            {pendingMembers.length > 0 ? (
                                <ul className="space-y-2">
                                    {pendingMembers.map((member) => (
                                        <li key={member.user_id} className="flex justify-between items-center bg-gray-800 p-4 rounded-lg">
                                            <span className="text-white">{member.name}</span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApproveMember(member.user_id)}
                                                    className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
                                                >
                                                    <i className="fas fa-check mr-1"></i>승인
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveMember(member.user_id, true)}
                                                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg"
                                                >
                                                    <i className="fas fa-times mr-1"></i>거절
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-400">승인 대기중인 신청이 없습니다.</p>
                            )}
                        </div>
                    )}

                    {/* Progress Tab */}
                    {activeTab === 'progress' && (
                        <div>
                            <h2 className="text-xl font-bold text-white mb-6">진행사항 관리</h2>
                            {progress.length > 0 ? (
                                <ul className="space-y-4">
                                    {progress.map((item) => (
                                        <li key={item.id} className="bg-gray-800 p-4 rounded-lg">
                                            {editingProgressId === item.id ? (
                                                <div className="space-y-3">
                                                    <input
                                                        type="text"
                                                        value={editProgressForm.title}
                                                        onChange={(e) => setEditProgressForm({ ...editProgressForm, title: e.target.value })}
                                                        className="w-full bg-gray-700 rounded-lg py-2 px-4 text-white"
                                                    />
                                                    <textarea
                                                        value={editProgressForm.content}
                                                        onChange={(e) => setEditProgressForm({ ...editProgressForm, content: e.target.value })}
                                                        rows="3"
                                                        className="w-full bg-gray-700 rounded-lg py-2 px-4 text-white"
                                                    ></textarea>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleUpdateProgress(item.id)}
                                                            className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
                                                        >
                                                            저장
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingProgressId(null)}
                                                            className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-white">{item.title}</h3>
                                                        <p className="text-gray-300 mt-1">{item.content}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingProgressId(item.id);
                                                                setEditProgressForm({ title: item.title, content: item.content });
                                                            }}
                                                            className="text-blue-400 hover:text-blue-300"
                                                        >
                                                            <i className="fas fa-edit"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteProgress(item.id)}
                                                            className="text-red-400 hover:text-red-300"
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-400">등록된 진행사항이 없습니다.</p>
                            )}
                        </div>
                    )}

                    {/* Resources Tab */}
                    {activeTab === 'resources' && (
                        <div>
                            <h2 className="text-xl font-bold text-white mb-6">자료 관리</h2>
                            {resources.length > 0 ? (
                                <ul className="space-y-2">
                                    {resources.map((resource) => (
                                        <li key={resource.id} className="flex justify-between items-center bg-gray-800 p-4 rounded-lg">
                                            <div className="flex items-center">
                                                <i className={`fas ${resource.format === 'pdf' ? 'fa-file-pdf text-red-400' : resource.format === 'docx' ? 'fa-file-word text-blue-400' : 'fa-file-powerpoint text-orange-400'} text-xl mr-3`}></i>
                                                <span className="text-white">{resource.name}</span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteResource(resource.id)}
                                                className="text-red-500 hover:text-red-400"
                                            >
                                                <i className="fas fa-trash mr-1"></i>삭제
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-400">업로드된 자료가 없습니다.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
