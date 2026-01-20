
import React, { useState, useEffect } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const sampleStudies = [
    {
        id: 1,
        title: 'Generative AI 프로젝트 스터디',
        leader: '김AI',
        period: '2025.05 - 2025.09',
        participants: ['김AI', '이데이터', '박머신', '최딥러닝', '정텐서', '한파이토치', '조트랜스'],
        status: 'ongoing',
        category: 'ai',
        year: 2025,
        techstack: ['Python', 'PyTorch', 'TensorFlow', 'Hugging Face'],
        description: 'LLM과 Diffusion Model을 활용한 생성형 AI 학습과 프로젝트 진행'
    },
    {
        id: 2,
        title: 'React 심화 스터디',
        leader: '박웹개발',
        period: '2025.03 - 2025.07',
        participants: ['박웹개발', '김리액트', '이타입스크립트', '최넥스트', '정훅스', '한컴포넌트'],
        status: 'ongoing',
        category: 'web',
        year: 2025,
        techstack: ['React', 'TypeScript', 'Next.js', 'Redux'],
        description: 'React의 고급 패턴과 성능 최적화를 학습하는 심화 스터디'
    },
];

const AdminStudy = () => {
    const [studies] = useState(sampleStudies);
    const [filteredStudies, setFilteredStudies] = useState(sampleStudies);
    const [filters, setFilters] = useState({ search: '', category: '', status: '', year: '' });

    const chartData = {
        labels: ['AI/ML', '웹 개발', '알고리즘', '모바일', '데이터'],
        datasets: [{
            data: [5, 10, 3, 2, 4],
            backgroundColor: ['#a8c5e6', '#a8e6c5', '#c5a8e6', '#e6a8c5', '#f59e0b'],
            borderWidth: 0
        }]
    };

    useEffect(() => {
        let result = studies.filter(study =>
            study.title.toLowerCase().includes(filters.search.toLowerCase()) &&
            (filters.category ? study.category === filters.category : true) &&
            (filters.status ? study.status === filters.status : true) &&
            (filters.year ? study.year.toString() === filters.year : true)
        );
        setFilteredStudies(result);
    }, [filters, studies]);

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    return (
        <div className="container mx-auto max-w-7xl">
            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">스터디 현황 대시보드</h3>
                <div className="widget-card p-6 rounded-xl">
                    <div className="chart-container" style={{ height: '150px' }}>
                        <Doughnut data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
                    </div>
                </div>
            </section>

            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">스터디 검색 및 필터</h3>
                <div className="search-filter-card p-6 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input type="text" name="search" placeholder="제목 검색" onChange={handleFilterChange} className="form-input" />
                        <select name="category" onChange={handleFilterChange} className="form-input">
                            <option value="">전체 분야</option>
                            <option value="ai">AI/ML</option>
                            <option value="web">웹 개발</option>
                        </select>
                        <select name="status" onChange={handleFilterChange} className="form-input">
                            <option value="">전체 상태</option>
                            <option value="ongoing">진행중</option>
                            <option value="completed">완료</option>
                        </select>
                        <select name="year" onChange={handleFilterChange} className="form-input">
                            <option value="">전체 연도</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                        </select>
                    </div>
                </div>
            </section>

            <section className="mb-8">
                <div className="widget-card rounded-xl overflow-hidden">
                    <table className="w-full">
                        {/* ... table head ... */}
                        <tbody>
                            {filteredStudies.map(study => (
                                <tr key={study.id} className="table-row">
                                    <td className="p-4"><input type="checkbox" /></td>
                                    <td className="p-4 text-white">{study.title}</td>
                                    <td className="p-4 text-white">{study.leader}</td>
                                    <td className="p-4 text-gray-300">{study.period}</td>
                                    <td className="p-4 text-white">{study.participants.length}명</td>
                                    <td className="p-4"><span className={`status-badge status-${study.status}`}>{study.status}</span></td>
                                    <td className="p-4">{/* Actions */}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default AdminStudy;
