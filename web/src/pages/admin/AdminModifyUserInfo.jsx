import React, { useState } from 'react';

const sampleUsers = [
    { id: 1, studentId: '2020001234', realName: '김민준', username: 'kimminjun', department: '컴퓨터공학과', phoneNumber: '010-1234-5678', email: 'kimminjun@seoultech.ac.kr', admissionYear: 2020, enrollmentStatus: '재학', birthday: '2000-03-15', currentWorkplace: '', techStack: ['JavaScript', 'React'], githubUrl: 'https://github.com/kimminjun', portfolioUrl: 'https://kimminjun.dev' },
    { id: 2, studentId: '2021005678', realName: '이서연', username: 'leeseoyeon', department: '인공지능응용학과', phoneNumber: '010-8765-4321', email: 'leeseoyeon@seoultech.ac.kr', admissionYear: 2021, enrollmentStatus: '재학', birthday: '2001-07-22', currentWorkplace: '', techStack: ['Python', 'TensorFlow'], githubUrl: 'https://github.com/leeseoyeon', portfolioUrl: '' },
];

const InfoRow = ({ label, id, value, onChange, editable = true }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
        <input type="text" id={id} value={value} onChange={onChange} readOnly={!editable} className={`form-input ${!editable ? 'bg-gray-700' : ''}`} />
    </div>
);

const AdminModifyUserInfo = () => {
    const [users, setUsers] = useState(sampleUsers);
    const [search, setSearch] = useState({ studentId: '', name: '', nickname: '' });
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [formData, setFormData] = useState(null);

    const handleSearch = () => {
        const results = users.filter(user =>
            (search.studentId && user.studentId.includes(search.studentId)) ||
            (search.name && user.realName.toLowerCase().includes(search.name.toLowerCase()))
        );
        setSearchResults(results);
        setSelectedUser(null);
    };

    const clearSearch = () => {
        setSearch({ studentId: '', name: '', nickname: '' });
        setSearchResults([]);
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setFormData({ ...user });
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        setUsers(users.map(user => user.id === formData.id ? formData : user));
        alert('User information updated!');
        setSelectedUser(null);
    };

    return (
        <div className="container mx-auto max-w-7xl p-6">
            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">사용자 정보 검색</h3>
                <div className="widget-card p-6 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <input name="studentId" value={search.studentId} onChange={(e) => setSearch({...search, studentId: e.target.value})} placeholder="학번으로 검색" className="form-input" />
                        <input name="name" value={search.name} onChange={(e) => setSearch({...search, name: e.target.value})} placeholder="이름으로 검색" className="form-input" />
                        <input name="nickname" value={search.nickname} onChange={(e) => setSearch({...search, nickname: e.target.value})} placeholder="닉네임으로 검색" className="form-input" />
                    </div>
                    <div className="flex space-x-2">
                        <button onClick={handleSearch} className="btn-primary">검색</button>
                        <button onClick={clearSearch} className="btn-secondary">초기화</button>
                    </div>
                </div>
            </section>

            {searchResults.length > 0 && !selectedUser && (
                <section className="mb-8">
                    <h3 className="text-2xl font-bold gradient-text mb-6">검색 결과 ({searchResults.length}명)</h3>
                    <div className="widget-card rounded-xl overflow-hidden">
                        <table className="w-full">{/* ... table ... */}</table>
                    </div>
                </section>
            )}

            {selectedUser && formData && (
                <section>
                    <h3 className="text-2xl font-bold gradient-text mb-6">{selectedUser.realName}님 정보 수정</h3>
                    <form onSubmit={handleFormSubmit} className="widget-card p-8 rounded-xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <InfoRow label="학번" id="studentId" value={formData.studentId} editable={false} />
                            {/* ... other InfoRow components ... */}
                        </div>
                        <div className="mt-8 text-right"><button type="submit" className="btn-primary">변경사항 저장</button></div>
                    </form>
                </section>
            )}
        </div>
    );
};

export default AdminModifyUserInfo;