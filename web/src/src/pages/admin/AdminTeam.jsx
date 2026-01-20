import React, { useState, useMemo } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const sampleTeams = [
    { id: 1, title: '2025 AI Creativity Hackathon', leader: '김AI', category: '해커톤', period: '2025.8.14 - 2025.12.18', neededRoles: ['기획자 1명', '프론트엔드 1명'], status: '모집중', year: 2025, techstack: ['Python', 'TensorFlow', 'React'], description: 'AI 창의성 해커톤 팀원 모집', deadline: '2025-11-30' },
    { id: 2, title: 'Software Maestro Pre-screening', leader: '이백엔드', category: '대회', period: '2025.08.04 - 2025.09.15', neededRoles: ['프론트엔드 1명'], status: '모집중', year: 2025, techstack: ['Spring', 'React', 'AWS'], description: '소프트웨어 마에스트로 대비', deadline: '2025-11-15' },
    { id: 3, title: '캠퍼스 생활 도우미 앱', leader: '박모바일', category: '프로젝트', period: '2025.09.01 - 2025.12.15', neededRoles: ['기획자 1명', '디자이너 2명'], status: '모집중', year: 2025, techstack: ['React Native', 'Node.js'], description: '캠퍼스 생활 편의 앱 개발', deadline: '2025-08-20' },
    { id: 4, title: 'ICPC 알고리즘 스터디', leader: '최알고리즘', category: '스터디', period: '2025.03.10 - 2025.05.30', neededRoles: ['알고리즘 3명'], status: '모집마감', year: 2025, techstack: ['C++', 'Algorithm'], description: 'ACM-ICPC 대비 스터디', deadline: '2025-03-01' },
    { id: 5, title: '블록체인 DeFi 프로젝트', leader: '강블록체인', category: '프로젝트', period: '2024.11.01 - 2025.02.28', neededRoles: ['블록체인 개발자 2명'], status: '모집마감', year: 2024, techstack: ['Solidity', 'Web3.js'], description: 'DeFi 플랫폼 개발 프로젝트', deadline: '2024-10-15' },
];

const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
const barChartOptions = { ...chartOptions, scales: { y: { beginAtZero: true, ticks: { color: '#ffffff' } }, x: { ticks: { color: '#ffffff' } } } };

const AdminTeam = () => {
    const [teams, setTeams] = useState(sampleTeams);
    const [filters, setFilters] = useState({ search: '', role: '', status: '', category: '', year: '' });
    const [sort, setSort] = useState({ column: 'title', order: 'asc' });
    const [selectedItems, setSelectedItems] = useState(new Set());

    const filteredAndSortedTeams = useMemo(() => {
        return [...teams]
            .filter(team => 
                (team.title.toLowerCase().includes(filters.search.toLowerCase())) &&
                (!filters.status || team.status === filters.status) &&
                (!filters.category || team.category === filters.category)
            )
            .sort((a, b) => {
                const aVal = a[sort.column];
                const bVal = b[sort.column];
                if (aVal < bVal) return sort.order === 'asc' ? -1 : 1;
                if (aVal > bVal) return sort.order === 'asc' ? 1 : -1;
                return 0;
            });
    }, [teams, filters, sort]);

    const stats = useMemo(() => ({
        total: teams.length,
        recruiting: teams.filter(t => t.status === '모집중').length,
        closed: teams.filter(t => t.status === '모집마감').length,
    }), [teams]);

    const categoryData = useMemo(() => ({
        labels: ['해커톤', '대회', '프로젝트', '스터디'],
        datasets: [{ data: [1, 1, 2, 1], backgroundColor: ['#a8c5e6', '#a8e6c5', '#c5a8e6', '#e6a8c5'], borderWidth: 0 }]
    }), []);

    const recruitmentStatusData = useMemo(() => ({
        labels: ['모집중', '모집마감'],
        datasets: [{ data: [stats.recruiting, stats.closed], backgroundColor: ['#a8c5e6', '#ef4444'], borderWidth: 0 }]
    }), [stats]);

    return (
        <div className="container mx-auto max-w-7xl p-6">
            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">팀 통계</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="widget-card p-6 rounded-xl">
                        <h4 className="font-bold text-lg mb-4 text-blue-300">총 팀 수</h4>
                        <div className="text-4xl font-black gradient-text mb-4">{stats.total}</div>
                        <ul className="text-sm text-gray-300 space-y-2">
                            <li className="flex justify-between"><span>모집중</span><span className="font-semibold text-blue-400">{stats.recruiting}</span></li>
                            <li className="flex justify-between"><span>모집마감</span><span className="font-semibold text-red-400">{stats.closed}</span></li>
                        </ul>
                    </div>
                    <div className="widget-card p-6 rounded-xl">
                        <h4 className="font-bold text-lg mb-4 text-pink-300">최근 활동</h4>
                        <div className="space-y-3"><div className="text-sm"><div className="flex items-center space-x-2 mb-1"><i className="fas fa-plus text-green-400"></i><span>새 팀 등록</span></div><div className="text-xs text-gray-500">1건 (오늘)</div></div><div className="text-sm"><div className="flex items-center space-x-2 mb-1"><i className="fas fa-user-plus text-blue-400"></i><span>지원자 등록</span></div><div className="text-xs text-gray-500">5건 (이번주)</div></div></div>
                    </div>
                    <div className="widget-card p-6 rounded-xl">
                        <h4 className="font-bold text-lg mb-4 text-yellow-300">카테고리 분포</h4>
                        <div className="chart-container" style={{ height: '150px' }}><Doughnut data={categoryData} options={chartOptions} /></div>
                    </div>
                    <div className="widget-card p-6 rounded-xl">
                        <h4 className="font-bold text-lg mb-4 text-green-300">모집 현황</h4>
                        <div className="chart-container" style={{ height: '150px' }}><Bar data={recruitmentStatusData} options={barChartOptions} /></div>
                    </div>
                </div>
            </section>

            {/* Search and Filter Section */}
            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">검색 및 필터</h3>
                {/* ... filter inputs ... */}
            </section>

            {/* Table Section */}
            <section className="mb-8">
                <div className="widget-card rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800"><tr><th className="p-4 text-left"><input type="checkbox" /></th><th className="p-4 text-left">팀명</th><th className="p-4 text-left">리더</th><th className="p-4 text-left">카테고리</th><th className="p-4 text-left">기간</th><th className="p-4 text-left">상태</th><th className="p-4 text-left">액션</th></tr></thead>
                            <tbody>
                                {filteredAndSortedTeams.map(team => (
                                    <tr key={team.id} className="table-row">
                                        <td className="p-4"><input type="checkbox" /></td>
                                        <td className="p-4"><div className="font-semibold text-white">{team.title}</div><div className="text-sm text-gray-400 mt-1">{team.description}</div></td>
                                        <td className="p-4">{team.leader}</td>
                                        <td className="p-4"><span className={`status-badge category-${team.category.toLowerCase()}`}>{team.category}</span></td>
                                        <td className="p-4">{team.period}</td>
                                        <td className="p-4"><span className={`status-badge status-${team.status === '모집중' ? 'recruiting' : 'closed'}`}>{team.status}</span></td>
                                        <td className="p-4"><div className="flex space-x-2"><button className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"><i className="fas fa-edit"></i></button><button className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"><i className="fas fa-trash"></i></button></div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AdminTeam;