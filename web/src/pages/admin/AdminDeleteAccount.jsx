
import React, { useState, useMemo, useEffect, useCallback } from 'react';

const AdminDeleteAccount = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({ search: '', role: '', tech: [] });
    const [sort, setSort] = useState({ by: 'name', order: 'asc' });
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Get all unique tech stacks from users
    const allTechStacks = useMemo(() => {
        const stacks = new Set();
        users.forEach(u => {
            if (u.tech_stack && Array.isArray(u.tech_stack)) {
                u.tech_stack.forEach(t => stacks.add(t));
            }
        });
        return Array.from(stacks).sort();
    }, [users]);

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

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleTechStackSelect = (tech) => {
        setFilters(prev => {
            const newTech = prev.tech.includes(tech) ? prev.tech.filter(t => t !== tech) : [...prev.tech, tech];
            return { ...prev, tech: newTech };
        });
    };

    const handleSort = (key) => {
        setSort(prev => ({
            by: key,
            order: prev.by === key && prev.order === 'asc' ? 'desc' : 'asc'
        }));
    };

    const clearFilters = () => {
        setFilters({ search: '', role: '', tech: [] });
    };

    const filteredUsers = useMemo(() => {
        return users
            .filter(u => {
                const searchLower = filters.search.toLowerCase();
                const nameMatch = u.name?.toLowerCase().includes(searchLower) || false;
                const usernameMatch = u.username?.toLowerCase().includes(searchLower) || false;
                const roleMatch = !filters.role || u.role === filters.role;
                const userTechStacks = u.tech_stack || [];
                const techMatch = filters.tech.length === 0 || filters.tech.every(t => userTechStacks.includes(t));
                return (nameMatch || usernameMatch) && roleMatch && techMatch;
            })
            .sort((a, b) => {
                const aVal = a[sort.by] || '';
                const bVal = b[sort.by] || '';
                if (aVal < bVal) return sort.order === 'asc' ? -1 : 1;
                if (aVal > bVal) return sort.order === 'asc' ? 1 : -1;
                return 0;
            });
    }, [users, filters, sort]);

    const techStackDisplay = useMemo(() => {
        if (filters.tech.length === 0) return '기술 스택 선택';
        if (filters.tech.length === 1) return filters.tech[0];
        return `${filters.tech[0]} 외 ${filters.tech.length - 1}개`;
    }, [filters.tech]);

    const handleDeleteClick = (user) => {
        setUserToDelete(user);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        
        setDeleteLoading(true);
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`/api/v1/admin/members/${userToDelete.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('계정 삭제에 실패했습니다');
            
            setUserToDelete(null);
            await fetchUsers();
            alert('계정이 삭제되었습니다.');
        } catch (err) {
            alert(err.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    const getRoleBadgeClass = (role) => {
        switch (role) {
            case 'ADMIN': return 'permission-admin';
            case 'MEMBER': return 'permission-member';
            case 'GUEST': return 'permission-guest';
            default: return 'permission-member';
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

    const TechStackDropdown = () => (
        <div className={`multiselect-dropdown ${isDropdownOpen ? 'show' : ''}`}>
            {allTechStacks.length === 0 ? (
                <div className="multiselect-option text-gray-400">기술 스택 없음</div>
            ) : (
                allTechStacks.map(tech => (
                    <div key={tech} 
                         className={`multiselect-option ${filters.tech.includes(tech) ? 'selected' : ''}`}
                         onClick={() => handleTechStackSelect(tech)}>
                        {tech}
                    </div>
                ))
            )}
        </div>
    );

    const DeleteModal = () => {
        if (!userToDelete) return null;
        return (
            <div className="modal show">
                <div className="modal-content">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-red-400">계정 삭제 확인</h3>
                        <button onClick={() => setUserToDelete(null)} className="text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
                    </div>
                    <div className="mb-6">
                        <div className="flex items-center space-x-4 p-4 bg-red-900 bg-opacity-20 rounded-lg border border-red-500 border-opacity-30">
                            <i className="fas fa-exclamation-triangle text-red-400 text-2xl"></i>
                            <div>
                                <p className="text-white font-semibold">정말로 이 계정을 삭제하시겠습니까?</p>
                                <p className="text-gray-300 text-sm mt-1">이 작업은 되돌릴 수 없으며, 사용자의 모든 데이터가 영구적으로 삭제됩니다.</p>
                            </div>
                        </div>
                        <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                            <div className="flex items-center space-x-3">
                                <img 
                                    src={userToDelete.profile_image || `https://via.placeholder.com/48/A8C5E6/FFFFFF?text=${(userToDelete.name || 'U').charAt(0)}`} 
                                    alt={userToDelete.name} 
                                    className="w-12 h-12 rounded-full object-cover" 
                                />
                                <div>
                                    <div className="text-white font-semibold">{userToDelete.name || '-'}</div>
                                    <div className="text-gray-400 text-sm">@{userToDelete.username}</div>
                                    <span className={`permission-badge ${getRoleBadgeClass(userToDelete.role)}`}>
                                        {getRoleDisplayName(userToDelete.role)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button className="btn-secondary" onClick={() => setUserToDelete(null)} disabled={deleteLoading}>취소</button>
                        <button className="btn-danger" onClick={confirmDelete} disabled={deleteLoading}>
                            {deleteLoading ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-trash mr-2"></i>}
                            삭제
                        </button>
                    </div>
                </div>
            </div>
        );
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
        <div className="container mx-auto max-w-7xl">
            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">계정 검색 및 삭제</h3>
                <div className="search-filter-card p-6 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">이름/아이디 검색</label>
                            <input type="text" name="search" value={filters.search} onChange={handleFilterChange} className="form-input" placeholder="이름 또는 아이디 입력..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">권한 필터</label>
                            <select name="role" value={filters.role} onChange={handleFilterChange} className="form-input">
                                <option value="">전체 권한</option>
                                <option value="ADMIN">관리자</option>
                                <option value="MEMBER">일반 멤버</option>
                                <option value="GUEST">게스트</option>
                            </select>
                        </div>
                        <div className="multiselect">
                            <label className="block text-sm font-medium text-gray-300 mb-2">기술 스택</label>
                            <div className="form-input cursor-pointer" onClick={() => setDropdownOpen(!isDropdownOpen)}>
                                <span>{techStackDisplay}</span>
                                <i className="fas fa-chevron-down float-right mt-1"></i>
                            </div>
                            <TechStackDropdown />
                        </div>
                    </div>
                </div>
            </section>

            <section className="mb-6">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">총 {filteredUsers.length}명의 사용자가 검색되었습니다.</span>
                    <button className="btn-primary btn-small" onClick={clearFilters}><i className="fas fa-undo mr-1"></i>필터 초기화</button>
                </div>
            </section>

            <section className="mb-8">
                <div className="widget-card rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800">
                                <tr>
                                    <th className="p-4 text-left">프로필</th>
                                    <th className="p-4 text-left sort-header" onClick={() => handleSort('name')}>
                                        <div className="flex items-center">이름/아이디<i className="fas fa-sort ml-2 text-gray-400"></i></div>
                                    </th>
                                    <th className="p-4 text-left sort-header" onClick={() => handleSort('role')}>
                                        <div className="flex items-center">권한<i className="fas fa-sort ml-2 text-gray-400"></i></div>
                                    </th>
                                    <th className="p-4 text-left">학번</th>
                                    <th className="p-4 text-left">기술 스택</th>
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
                                        <tr key={user.id} className="table-row border-b border-gray-700 hover:bg-gray-800/50">
                                            <td className="p-4">
                                                <img 
                                                    src={user.profile_image || `https://via.placeholder.com/48/A8C5E6/FFFFFF?text=${(user.name || 'U').charAt(0)}`} 
                                                    alt={user.name} 
                                                    className="w-12 h-12 rounded-full object-cover" 
                                                />
                                            </td>
                                            <td className="p-4">
                                                <div className="font-semibold text-white">{user.name || '-'}</div>
                                                <div className="text-sm text-gray-400">@{user.username}</div>
                                                <div className="text-xs text-gray-500 mt-1">가입일: {formatDate(user.created_at)}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`permission-badge ${getRoleBadgeClass(user.role)}`}>
                                                    {getRoleDisplayName(user.role)}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-white">{user.student_number || '-'}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {(user.tech_stack || []).slice(0, 3).map(t => (
                                                        <span key={t} className="tech-tag text-xs px-2 py-1 bg-gray-700 rounded">{t}</span>
                                                    ))}
                                                    {(user.tech_stack || []).length > 3 && (
                                                        <span className="text-xs text-gray-400 ml-1">+{user.tech_stack.length - 3}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button className="btn-danger btn-small" onClick={() => handleDeleteClick(user)}>
                                                    <i className="fas fa-trash mr-1"></i>삭제
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
            <DeleteModal />
        </div>
    );
};

export default AdminDeleteAccount;
