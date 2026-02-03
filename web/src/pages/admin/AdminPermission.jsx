import React, { useState, useMemo, useEffect, useCallback } from 'react';

const AdminPermission = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({ search: '', role: '', tech: [] });
    const [sort, setSort] = useState({ by: 'name', order: 'asc' });
    const [selected, setSelected] = useState(new Set());
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

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

    const toggleSelectAll = (e) => {
        if (e.target.checked) {
            setSelected(new Set(filteredUsers.map(u => u.id)));
        } else {
            setSelected(new Set());
        }
    };

    const handleSelect = (id) => {
        setSelected(prev => {
            const newSelected = new Set(prev);
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
            return newSelected;
        });
    };

    const updateUserRole = async (userId, newRole) => {
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`/api/v1/admin/members/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ role: newRole })
            });
            if (!res.ok) throw new Error('권한 변경에 실패했습니다');
            return true;
        } catch (err) {
            alert(err.message);
            return false;
        }
    };

    const handleBulkRoleChange = async (newRole) => {
        if (selected.size === 0) return;
        
        const roleNames = { ADMIN: '관리자', MEMBER: '일반 멤버', GUEST: '게스트' };
        if (!window.confirm(`선택한 ${selected.size}명의 권한을 ${roleNames[newRole]}(으)로 변경하시겠습니까?`)) return;
        
        setActionLoading(true);
        try {
            const promises = Array.from(selected).map(id => updateUserRole(id, newRole));
            await Promise.all(promises);
            await fetchUsers();
            setSelected(new Set());
            alert('권한이 변경되었습니다.');
        } catch (err) {
            alert('일부 권한 변경에 실패했습니다.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSingleRoleChange = async (userId, newRole) => {
        const roleNames = { ADMIN: '관리자', MEMBER: '일반 멤버', GUEST: '게스트' };
        if (!window.confirm(`이 사용자의 권한을 ${roleNames[newRole]}(으)로 변경하시겠습니까?`)) return;
        
        const success = await updateUserRole(userId, newRole);
        if (success) {
            await fetchUsers();
        }
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

    const stats = useMemo(() => ({
        total: users.length,
        admins: users.filter(u => u.role === 'ADMIN').length,
        members: users.filter(u => u.role === 'MEMBER').length,
        guests: users.filter(u => u.role === 'GUEST').length,
    }), [users]);

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

    const techStackDisplay = useMemo(() => {
        if (filters.tech.length === 0) return '기술 스택 선택';
        if (filters.tech.length === 1) return filters.tech[0];
        return `${filters.tech[0]} 외 ${filters.tech.length - 1}개`;
    }, [filters.tech]);

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
            {/* Statistics */}
            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">권한 관리 통계</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="widget-card p-6 rounded-xl">
                        <h4 className="font-bold text-lg mb-4 text-blue-300">총 사용자</h4>
                        <div className="text-4xl font-black gradient-text mb-4">{stats.total}</div>
                        <ul className="text-sm text-gray-300 space-y-2">
                            <li className="flex justify-between"><span>전체 회원</span><span className="font-semibold text-blue-400">{stats.total}</span></li>
                        </ul>
                    </div>
                    <div className="widget-card p-6 rounded-xl">
                        <h4 className="font-bold text-lg mb-4 text-purple-300">관리자</h4>
                        <div className="text-4xl font-black gradient-text mb-4">{stats.admins}</div>
                        <ul className="text-sm text-gray-300 space-y-2">
                            <li className="flex justify-between"><span>Admin 권한</span><span className="font-semibold text-purple-400">{stats.admins}</span></li>
                        </ul>
                    </div>
                    <div className="widget-card p-6 rounded-xl">
                        <h4 className="font-bold text-lg mb-4 text-green-300">일반 멤버</h4>
                        <div className="text-4xl font-black gradient-text mb-4">{stats.members}</div>
                        <ul className="text-sm text-gray-300 space-y-2">
                            <li className="flex justify-between"><span>Member 권한</span><span className="font-semibold text-green-400">{stats.members}</span></li>
                        </ul>
                    </div>
                    <div className="widget-card p-6 rounded-xl">
                        <h4 className="font-bold text-lg mb-4 text-yellow-300">게스트</h4>
                        <div className="text-4xl font-black gradient-text mb-4">{stats.guests}</div>
                        <ul className="text-sm text-gray-300 space-y-2">
                            <li className="flex justify-between"><span>Guest 권한</span><span className="font-semibold text-yellow-400">{stats.guests}</span></li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Search and Filter */}
            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">사용자 검색 및 필터</h3>
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

            {/* Bulk Actions */}
            <section className="mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                    <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2">
                            <input type="checkbox" onChange={toggleSelectAll} checked={selected.size > 0 && selected.size === filteredUsers.length} className="form-checkbox" />
                            <span className="text-sm text-gray-300">전체 선택</span>
                        </label>
                        <span className="text-sm text-gray-400">{selected.size}개 선택됨</span>
                    </div>
                    {selected.size > 0 && (
                        <div className="flex flex-wrap gap-2">
                            <button 
                                className="btn-primary text-sm" 
                                onClick={() => handleBulkRoleChange('ADMIN')}
                                disabled={actionLoading}
                            >
                                <i className="fas fa-user-shield mr-1"></i>관리자 권한 부여
                            </button>
                            <button 
                                className="btn-success text-sm" 
                                onClick={() => handleBulkRoleChange('MEMBER')}
                                disabled={actionLoading}
                            >
                                <i className="fas fa-user mr-1"></i>멤버 권한 부여
                            </button>
                            <button 
                                className="btn-warning text-sm" 
                                onClick={() => handleBulkRoleChange('GUEST')}
                                disabled={actionLoading}
                            >
                                <i className="fas fa-user-minus mr-1"></i>게스트로 변경
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/* Users Table */}
            <section className="mb-8">
                <div className="widget-card rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800">
                                <tr>
                                    <th className="p-4 text-left">
                                        <input type="checkbox" onChange={toggleSelectAll} checked={selected.size > 0 && selected.size === filteredUsers.length} className="form-checkbox" />
                                    </th>
                                    <th className="p-4 text-left">프로필</th>
                                    <th className="p-4 text-left sort-header" onClick={() => handleSort('name')}>
                                        <div className="flex items-center">이름/아이디<i className="fas fa-sort ml-2 text-gray-400"></i></div>
                                    </th>
                                    <th className="p-4 text-left sort-header" onClick={() => handleSort('role')}>
                                        <div className="flex items-center">현재 권한<i className="fas fa-sort ml-2 text-gray-400"></i></div>
                                    </th>
                                    <th className="p-4 text-left">학번</th>
                                    <th className="p-4 text-left">기술 스택</th>
                                    <th className="p-4 text-left">액션</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="p-8 text-center text-gray-400">
                                            사용자가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map(user => (
                                        <tr key={user.id} className="table-row border-b border-gray-700 hover:bg-gray-800/50">
                                            <td className="p-4">
                                                <input type="checkbox" checked={selected.has(user.id)} onChange={() => handleSelect(user.id)} className="item-checkbox" />
                                            </td>
                                            <td className="p-4">
                                                <img 
                                                    src={user.profile_image || `https://via.placeholder.com/40/A8C5E6/FFFFFF?text=${(user.name || 'U').charAt(0)}`} 
                                                    alt={user.name} 
                                                    className="w-10 h-10 rounded-full object-cover" 
                                                />
                                            </td>
                                            <td className="p-4">
                                                <div className="font-semibold text-white">{user.name || '-'}</div>
                                                <div className="text-sm text-gray-400">@{user.username}</div>
                                                <div className="text-xs text-gray-500 mt-1">가입: {formatDate(user.created_at)}</div>
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
                                            <td className="p-4">
                                                <div className="flex space-x-2">
                                                    <div className="group relative">
                                                        <button 
                                                            className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50" 
                                                            disabled={user.role === 'ADMIN'}
                                                            onClick={() => handleSingleRoleChange(user.id, 'ADMIN')}
                                                        >
                                                            <i className="fas fa-user-shield"></i>
                                                        </button>
                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            관리자로 변경
                                                        </span>
                                                    </div>
                                                    <div className="group relative">
                                                        <button 
                                                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50" 
                                                            disabled={user.role === 'MEMBER'}
                                                            onClick={() => handleSingleRoleChange(user.id, 'MEMBER')}
                                                        >
                                                            <i className="fas fa-user"></i>
                                                        </button>
                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            멤버로 변경
                                                        </span>
                                                    </div>
                                                    <div className="group relative">
                                                        <button 
                                                            className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50" 
                                                            disabled={user.role === 'GUEST'}
                                                            onClick={() => handleSingleRoleChange(user.id, 'GUEST')}
                                                        >
                                                            <i className="fas fa-user-minus"></i>
                                                        </button>
                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            게스트로 변경
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AdminPermission;