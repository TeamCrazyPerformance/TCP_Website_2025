
import React, { useState, useMemo } from 'react';

const sampleUsers = [
    { id: 1, name: '김민준', nickname: 'kimminjun', role: 'Admin', position: 'Frontend', techStacks: ['React', 'JavaScript', 'Node.js'], profileImage: 'https://via.placeholder.com/40/A8C5E6/FFFFFF?text=김', joinDate: '2023-03-15', lastActive: '2024-01-15' },
    { id: 2, name: '이서연', nickname: 'leeseoyeon', role: 'Study Leader', position: 'AI', techStacks: ['Python', 'AI/ML', 'TensorFlow'], profileImage: 'https://via.placeholder.com/40/C5A8E6/FFFFFF?text=이', joinDate: '2023-05-20', lastActive: '2024-01-14' },
    { id: 3, name: '박지훈', nickname: 'parkjihun', role: 'Study Leader', position: 'Backend', techStacks: ['Java', 'Spring', 'MySQL'], profileImage: 'https://via.placeholder.com/40/A8E6C5/FFFFFF?text=박', joinDate: '2023-04-10', lastActive: '2024-01-13' },
    { id: 4, name: '최예원', nickname: 'choiyewon', role: 'Member', position: 'Mobile', techStacks: ['Swift', 'Flutter', 'Kotlin'], profileImage: 'https://via.placeholder.com/40/E6A8C5/FFFFFF?text=최', joinDate: '2023-06-01', lastActive: '2024-01-12' },
    { id: 5, name: '정수현', nickname: 'jeongsuhyun', role: 'Member', position: 'Frontend', techStacks: ['Vue.js', 'JavaScript', 'TypeScript'], profileImage: 'https://via.placeholder.com/40/A8C5E6/FFFFFF?text=정', joinDate: '2023-07-15', lastActive: '2024-01-11' },
];

const allTechStacks = ['React', 'Vue.js', 'Angular', 'Node.js', 'Python', 'Java', 'JavaScript', 'TypeScript', 'Spring', 'Django', 'Flutter', 'Swift', 'Kotlin', 'AI/ML', 'TensorFlow', 'PyTorch'];

const AdminDeleteAccount = () => {
    const [users, setUsers] = useState(sampleUsers);
    const [filters, setFilters] = useState({ search: '', role: '', position: '', tech: [] });
    const [sort, setSort] = useState({ by: 'name', order: 'asc' });
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

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
        setFilters({ search: '', role: '', position: '', tech: [] });
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

    const techStackDisplay = useMemo(() => {
        if (filters.tech.length === 0) return '기술 스택 선택';
        if (filters.tech.length === 1) return filters.tech[0];
        return `${filters.tech[0]} 외 ${filters.tech.length - 1}개`;
    }, [filters.tech]);

    const handleDeleteClick = (user) => {
        setUserToDelete(user);
    };

    const confirmDelete = () => {
        if (!userToDelete) return;
        setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
        setUserToDelete(null);
    };

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

    const DeleteModal = () => {
        if (!userToDelete) return null;
        const roleClass = `permission-${userToDelete.role === 'Admin' ? 'admin' : userToDelete.role === 'Study Leader' ? 'leader' : 'member'}`;
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
                                <img src={userToDelete.profileImage} alt={userToDelete.name} className="w-12 h-12 rounded-full" />
                                <div>
                                    <div className="text-white font-semibold">{userToDelete.name}</div>
                                    <div className="text-gray-400 text-sm">@{userToDelete.nickname}</div>
                                    <span className={`permission-badge ${roleClass}`}>{userToDelete.role}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button className="btn-secondary" onClick={() => setUserToDelete(null)}>취소</button>
                        <button className="btn-danger" onClick={confirmDelete}><i className="fas fa-trash mr-2"></i>삭제</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto max-w-7xl">
            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">계정 검색 및 삭제</h3>
                <div className="search-filter-card p-6 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">이름/닉네임 검색</label>
                            <div className="relative"><i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i><input type="text" name="search" value={filters.search} onChange={handleFilterChange} className="form-input pl-10" placeholder="이름 또는 닉네임 입력..." /></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">권한 역할</label>
                            <select name="role" value={filters.role} onChange={handleFilterChange} className="form-input"><option value="">전체 권한</option><option value="Admin">관리자</option><option value="Study Leader">스터디 리더</option><option value="Member">일반 멤버</option></select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">포지션</label>
                            <select name="position" value={filters.position} onChange={handleFilterChange} className="form-input"><option value="">전체 포지션</option><option value="Frontend">Frontend</option><option value="Backend">Backend</option><option value="AI">AI</option><option value="Mobile">Mobile</option><option value="DevOps">DevOps</option><option value="Design">Design</option></select>
                        </div>
                        <div className="multiselect">
                            <label className="block text-sm font-medium text-gray-300 mb-2">기술 스택</label>
                            <div className="form-input cursor-pointer" onClick={() => setDropdownOpen(!isDropdownOpen)}><span>{techStackDisplay}</span><i className="fas fa-chevron-down float-right mt-1"></i></div>
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
                                    <th className="p-4 text-left sort-header" onClick={() => handleSort('name')}><div className="flex items-center">프로필<i className="fas fa-sort ml-2 text-gray-400"></i></div></th>
                                    <th className="p-4 text-left sort-header" onClick={() => handleSort('name')}><div className="flex items-center">이름/닉네임<i className="fas fa-sort ml-2 text-gray-400"></i></div></th>
                                    <th className="p-4 text-left sort-header" onClick={() => handleSort('role')}><div className="flex items-center">권한 역할<i className="fas fa-sort ml-2 text-gray-400"></i></div></th>
                                    <th className="p-4 text-left">포지션</th>
                                    <th className="p-4 text-left">기술 스택</th>
                                    <th className="p-4 text-center">작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => {
                                    const roleClass = `permission-${user.role === 'Admin' ? 'admin' : user.role === 'Study Leader' ? 'leader' : 'member'}`;
                                    return (
                                        <tr key={user.id} className="table-row">
                                            <td className="p-4"><img src={user.profileImage} alt={user.name} className="w-12 h-12 rounded-full" /></td>
                                            <td className="p-4"><div className="font-semibold text-white">{user.name}</div><div className="text-sm text-gray-400">@{user.nickname}</div><div className="text-xs text-gray-500 mt-1">가입일: {user.joinDate}</div></td>
                                            <td className="p-4"><span className={`permission-badge ${roleClass}`}>{user.role}</span><div className="text-xs text-gray-500 mt-1">최종 활동: {user.lastActive}</div></td>
                                            <td className="p-4"><div className="text-white font-medium">{user.position}</div></td>
                                            <td className="p-4"><div className="flex flex-wrap">{user.techStacks.slice(0, 3).map(t => <span key={t} className="tech-tag">{t}</span>)}{user.techStacks.length > 3 && <span className="text-xs text-gray-400 ml-1">+{user.techStacks.length - 3}</span>}</div></td>
                                            <td className="p-4 text-center"><button className="btn-danger btn-small" onClick={() => handleDeleteClick(user)}><i className="fas fa-trash mr-1"></i>삭제</button></td>
                                        </tr>
                                    );
                                })}
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
