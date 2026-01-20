import React, { useState, useMemo, useEffect, useCallback } from 'react';

const sampleUsers = [
    { id: 1, name: '김민준', nickname: 'kimminjun', role: 'Admin', position: 'Frontend', techStacks: ['React', 'JavaScript', 'Node.js'], profileImage: 'https://via.placeholder.com/40/A8C5E6/FFFFFF?text=KM', joinDate: '2023-03-15', lastActive: '2024-01-15' },
    { id: 2, name: '이서연', nickname: 'leeseoyeon', role: 'Study Leader', position: 'AI', techStacks: ['Python', 'AI/ML', 'TensorFlow'], profileImage: 'https://via.placeholder.com/40/C5A8E6/FFFFFF?text=LS', joinDate: '2023-05-20', lastActive: '2024-01-14' },
    { id: 3, name: '박지훈', nickname: 'parkjihun', role: 'Study Leader', position: 'Backend', techStacks: ['Java', 'Spring', 'MySQL'], profileImage: 'https://via.placeholder.com/40/A8E6C5/FFFFFF?text=PJ', joinDate: '2023-04-10', lastActive: '2024-01-13' },
    { id: 4, name: '최예원', nickname: 'choiyewon', role: 'Member', position: 'Mobile', techStacks: ['Swift', 'Flutter', 'Kotlin'], profileImage: 'https://via.placeholder.com/40/E6A8C5/FFFFFF?text=CY', joinDate: '2023-06-01', lastActive: '2024-01-12' },
    { id: 5, name: '정수현', nickname: 'jeongsuhyun', role: 'Member', position: 'Frontend', techStacks: ['Vue.js', 'JavaScript', 'TypeScript'], profileImage: 'https://via.placeholder.com/40/A8C5E6/FFFFFF?text=JS', joinDate: '2023-07-15', lastActive: '2024-01-11' },
    { id: 6, name: '한동민', nickname: 'handongmin', role: 'Study Leader', position: 'AI', techStacks: ['Python', 'PyTorch', 'AI/ML'], profileImage: 'https://via.placeholder.com/40/C5A8E6/FFFFFF?text=HD', joinDate: '2023-08-20', lastActive: '2024-01-10' },
    { id: 7, name: '오성민', nickname: 'ohseongmin', role: 'Member', position: 'Backend', techStacks: ['Node.js', 'JavaScript', 'MongoDB'], profileImage: 'https://via.placeholder.com/40/A8E6C5/FFFFFF?text=OS', joinDate: '2023-09-05', lastActive: '2024-01-09' },
    { id: 8, name: '강유진', nickname: 'kangyujin', role: 'Member', position: 'Design', techStacks: ['React', 'CSS', 'Figma'], profileImage: 'https://via.placeholder.com/40/E6A8C5/FFFFFF?text=KY', joinDate: '2023-10-12', lastActive: '2024-01-08' },
    { id: 9, name: '임재현', nickname: 'limjaehyun', role: 'Admin', position: 'DevOps', techStacks: ['AWS', 'Docker', 'Kubernetes'], profileImage: 'https://via.placeholder.com/40/A8C5E6/FFFFFF?text=LJ', joinDate: '2023-02-28', lastActive: '2024-01-07' },
    { id: 10, name: '윤하은', nickname: 'yunhaeun', role: 'Study Leader', position: 'Frontend', techStacks: ['Angular', 'TypeScript', 'RxJS'], profileImage: 'https://via.placeholder.com/40/C5A8E6/FFFFFF?text=YH', joinDate: '2023-11-03', lastActive: '2024-01-06' },
];

const allTechStacks = ['React', 'Vue.js', 'Angular', 'Node.js', 'Python', 'Java', 'JavaScript', 'TypeScript', 'Spring', 'Django', 'Flutter', 'Swift', 'Kotlin', 'AI/ML', 'TensorFlow', 'PyTorch', 'AWS', 'Docker', 'Kubernetes', 'CSS', 'Figma', 'MySQL', 'MongoDB', 'RxJS'];

const AdminPermission = () => {
    const [users, setUsers] = useState(sampleUsers);
    const [filters, setFilters] = useState({ search: '', role: '', position: '', tech: [] });
    const [sort, setSort] = useState({ by: 'name', order: 'asc' });
    const [selected, setSelected] = useState(new Set());
    const [isDropdownOpen, setDropdownOpen] = useState(false);

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

    const filteredUsers = useMemo(() => {
        return users
            .filter(u => {
                const searchLower = filters.search.toLowerCase();
                const nameMatch = u.name.toLowerCase().includes(searchLower);
                const nickMatch = u.nickname.toLowerCase().includes(searchLower);
                const roleMatch = !filters.role || u.role === filters.role;
                const posMatch = !filters.position || u.position === filters.position;
                const techMatch = filters.tech.length === 0 || filters.tech.every(t => u.techStacks.includes(t));
                return (nameMatch || nickMatch) && roleMatch && posMatch && techMatch;
            })
            .sort((a, b) => {
                const aVal = a[sort.by];
                const bVal = b[sort.by];
                if (aVal < bVal) return sort.order === 'asc' ? -1 : 1;
                if (aVal > bVal) return sort.order === 'asc' ? 1 : -1;
                return 0;
            });
    }, [users, filters, sort]);

    const stats = useMemo(() => ({
        total: users.length,
        active: 22, // static
        inactive: 2, // static
        admins: users.filter(u => u.role === 'Admin').length,
        leaders: users.filter(u => u.role === 'Study Leader').length,
        members: users.filter(u => u.role === 'Member').length,
    }), [users]);

    const TechStackDropdown = () => (
        <div className={`multiselect-dropdown ${isDropdownOpen ? 'show' : ''}`}>
            {allTechStacks.map(tech => (
                <div key={tech} 
                     className={`multiselect-option ${filters.tech.includes(tech) ? 'selected' : ''}`}
                     onClick={() => handleTechStackSelect(tech)}>
                    {tech}
                </div>
            ))}
        </div>
    );

    const techStackDisplay = useMemo(() => {
        if (filters.tech.length === 0) return '기술 스택 선택';
        if (filters.tech.length === 1) return filters.tech[0];
        return `${filters.tech[0]} 외 ${filters.tech.length - 1}개`;
    }, [filters.tech]);

    return (
        <div className="container mx-auto max-w-7xl">
            {/* Statistics */}
            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">권한 관리 통계</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="widget-card p-6 rounded-xl"><h4 className="font-bold text-lg mb-4 text-blue-300">총 사용자</h4><div className="text-4xl font-black gradient-text mb-4">{stats.total}</div><ul className="text-sm text-gray-300 space-y-2"><li className="flex justify-between"><span>활성 계정</span><span className="font-semibold text-blue-400">{stats.active}</span></li><li className="flex justify-between"><span>비활성 계정</span><span className="font-semibold text-red-400">{stats.inactive}</span></li></ul></div>
                    <div className="widget-card p-6 rounded-xl"><h4 className="font-bold text-lg mb-4 text-purple-300">관리자</h4><div className="text-4xl font-black gradient-text mb-4">{stats.admins}</div><ul className="text-sm text-gray-300 space-y-2"><li className="flex justify-between"><span>슈퍼 관리자</span><span className="font-semibold text-white">1</span></li><li className="flex justify-between"><span>일반 관리자</span><span className="font-semibold text-white">{stats.admins > 0 ? stats.admins -1 : 0}</span></li></ul></div>
                    <div className="widget-card p-6 rounded-xl"><h4 className="font-bold text-lg mb-4 text-green-300">스터디 리더</h4><div className="text-4xl font-black gradient-text mb-4">{stats.leaders}</div><ul className="text-sm text-gray-300 space-y-2"><li className="flex justify-between"><span>활성 리더</span><span className="font-semibold text-white">{stats.leaders}</span></li><li className="flex justify-between"><span>승인 대기</span><span className="font-semibold text-white">0</span></li></ul></div>
                    <div className="widget-card p-6 rounded-xl"><h4 className="font-bold text-lg mb-4 text-pink-300">일반 멤버</h4><div className="text-4xl font-black gradient-text mb-4">{stats.members}</div><ul className="text-sm text-gray-300 space-y-2"><li className="flex justify-between"><span>신규 멤버</span><span className="font-semibold text-white">3</span></li><li className="flex justify-between"><span>기존 멤버</span><span className="font-semibold text-white">{stats.members > 3 ? stats.members - 3 : 0}</span></li></ul></div>
                </div>
            </section>

            {/* Search and Filter */}
            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">사용자 검색 및 필터</h3>
                <div className="search-filter-card p-6 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">이름/닉네임 검색</label>
                            <div className="relative"><i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i><input type="text" name="search" value={filters.search} onChange={handleFilterChange} className="form-input pl-10" placeholder="이름 또는 닉네임 입력..." /></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">역할 필터</label>
                            <select name="role" value={filters.role} onChange={handleFilterChange} className="form-input"><option value="">전체 역할</option><option value="Admin">관리자</option><option value="Study Leader">스터디 리더</option><option value="Member">일반 멤버</option></select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">포지션 필터</label>
                            <select name="position" value={filters.position} onChange={handleFilterChange} className="form-input"><option value="">전체 포지션</option><option value="Frontend">프론트엔드</option><option value="Backend">백엔드</option><option value="AI">AI</option><option value="Mobile">모바일</option><option value="DevOps">DevOps</option><option value="Design">디자인</option></select>
                        </div>
                        <div className="multiselect">
                            <label className="block text-sm font-medium text-gray-300 mb-2">기술 스택</label>
                            <div className="form-input cursor-pointer" onClick={() => setDropdownOpen(!isDropdownOpen)}><span id="techStackDisplay">{techStackDisplay}</span><i className="fas fa-chevron-down float-right mt-1"></i></div>
                            <TechStackDropdown />
                        </div>
                    </div>
                </div>
            </section>

            {/* Bulk Actions */}
            <section className="mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                    <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2"><input type="checkbox" onChange={toggleSelectAll} checked={selected.size > 0 && selected.size === filteredUsers.length} className="form-checkbox" /><span className="text-sm text-gray-300">전체 선택</span></label>
                        <span className="text-sm text-gray-400">{selected.size}개 선택됨</span>
                    </div>
                    {selected.size > 0 && <div className="flex flex-wrap gap-2"><button className="btn-primary text-sm"><i className="fas fa-user-shield mr-1"></i>관리자 권한 부여</button><button className="btn-success text-sm"><i className="fas fa-crown mr-1"></i>리더 권한 부여</button><button className="btn-warning text-sm"><i className="fas fa-user-minus mr-1"></i>권한 해지</button></div>}
                </div>
            </section>

            {/* Users Table */}
            <section className="mb-8">
                <div className="widget-card rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800">
                                <tr>
                                    <th className="p-4 text-left"><input type="checkbox" onChange={toggleSelectAll} checked={selected.size > 0 && selected.size === filteredUsers.length} className="form-checkbox" /></th>
                                    <th className="p-4 text-left sort-header" onClick={() => handleSort('profile')}><div className="flex items-center">프로필<i className="fas fa-sort ml-2 text-gray-400"></i></div></th>
                                    <th className="p-4 text-left sort-header" onClick={() => handleSort('name')}><div className="flex items-center">이름/닉네임<i className="fas fa-sort ml-2 text-gray-400"></i></div></th>
                                    <th className="p-4 text-left sort-header" onClick={() => handleSort('role')}><div className="flex items-center">현재 권한<i className="fas fa-sort ml-2 text-gray-400"></i></div></th>
                                    <th className="p-4 text-left">포지션</th>
                                    <th className="p-4 text-left">기술 스택</th>
                                    <th className="p-4 text-left">액션</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => {
                                    const roleClass = `permission-${user.role === 'Admin' ? 'admin' : user.role === 'Study Leader' ? 'leader' : 'member'}`;
                                    return (
                                        <tr key={user.id} className="table-row">
                                            <td className="p-4"><input type="checkbox" checked={selected.has(user.id)} onChange={() => handleSelect(user.id)} className="item-checkbox" /></td>
                                            <td className="p-4"><img src={user.profileImage} alt={user.name} className="w-10 h-10 rounded-full" /></td>
                                            <td className="p-4"><div className="font-semibold text-white">{user.name}</div><div className="text-sm text-gray-400">@{user.nickname}</div><div className="text-xs text-gray-500 mt-1">가입: {user.joinDate}</div></td>
                                            <td className="p-4"><span className={`permission-badge ${roleClass}`}>{user.role}</span><div className="text-xs text-gray-500 mt-1">최근 활동: {user.lastActive}</div></td>
                                            <td className="p-4"><div className="text-white font-medium">{user.position}</div></td>
                                            <td className="p-4"><div className="flex flex-wrap">{user.techStacks.slice(0, 3).map(t => <span key={t} className="tech-tag">{t}</span>)}{user.techStacks.length > 3 && <span className="text-xs text-gray-400 ml-1">+{user.techStacks.length - 3}</span>}</div></td>
                                            <td className="p-4"><div className="flex space-x-2"><button className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" disabled={user.role === 'Admin'}><i className="fas fa-user-shield"></i></button><button className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700" disabled={user.role !== 'Member'}><i className="fas fa-crown"></i></button><button className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700" disabled={user.role === 'Member'}><i className="fas fa-user-minus"></i></button></div></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AdminPermission;