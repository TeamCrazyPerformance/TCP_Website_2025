import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const AdminStudy = () => {
    const navigate = useNavigate();
    const [studies, setStudies] = useState([]);
    const [filteredStudies, setFilteredStudies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({ search: '', tag: '', year: '', status: '' });
    const [availableYears, setAvailableYears] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);

    const fetchStudies = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch('/api/v1/study', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch studies');
            const data = await res.json();
            const studyList = Array.isArray(data) ? data : [];
            setStudies(studyList);
            setFilteredStudies(studyList);

            // Extract unique years and tags (split comma-separated tags)
            const years = [...new Set(studyList.map(s => s.start_year))].sort((a, b) => b - a);
            const allTags = studyList.flatMap(s => 
                s.tag ? s.tag.split(',').map(t => t.trim()).filter(Boolean) : []
            );
            const tags = [...new Set(allTags)].sort();
            setAvailableYears(years);
            setAvailableTags(tags);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStudies();
    }, [fetchStudies]);

    useEffect(() => {
        let result = studies.filter(study => {
            const matchSearch = study.study_name?.toLowerCase().includes(filters.search.toLowerCase());
            // Split study's tag and check if selected tag is included
            const studyTags = study.tag ? study.tag.split(',').map(t => t.trim()) : [];
            const matchTag = !filters.tag || studyTags.includes(filters.tag);
            const matchYear = !filters.year || study.start_year?.toString() === filters.year;
            // Status filter
            const deadlinePassed = study.apply_deadline ? new Date(study.apply_deadline) < new Date() : false;
            const matchStatus = !filters.status || 
                (filters.status === 'recruiting' && !deadlinePassed) ||
                (filters.status === 'closed' && deadlinePassed);
            return matchSearch && matchTag && matchYear && matchStatus;
        });
        setFilteredStudies(result);
    }, [filters, studies]);

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    // Calculate tag statistics for chart (split comma-separated tags)
    const tagCounts = studies.reduce((acc, study) => {
        const tags = study.tag ? study.tag.split(',').map(t => t.trim()).filter(Boolean) : ['기타'];
        tags.forEach(tag => {
            acc[tag] = (acc[tag] || 0) + 1;
        });
        return acc;
    }, {});

    const chartColors = ['#a8c5e6', '#a8e6c5', '#c5a8e6', '#e6a8c5', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899'];
    const chartData = {
        labels: Object.keys(tagCounts),
        datasets: [{
            data: Object.values(tagCounts),
            backgroundColor: chartColors.slice(0, Object.keys(tagCounts).length),
            borderWidth: 0
        }]
    };

    // Check if deadline is passed
    const isDeadlinePassed = (deadline) => {
        if (!deadline) return false;
        return new Date(deadline) < new Date();
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('ko-KR');
    };

    if (loading) return <div className="p-8 text-center text-white">로딩 중...</div>;
    if (error) return <div className="p-8 text-center text-red-500">에러: {error}</div>;

    return (
        <div className="container mx-auto max-w-7xl p-6">
            <section className="mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-3xl font-bold gradient-text">스터디 현황 대시보드</h3>
                    <button onClick={fetchStudies} className="btn-secondary text-sm">
                        <i className="fas fa-sync mr-2"></i>새로고침
                    </button>
                </div>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="widget-card p-4 rounded-xl">
                        <div className="text-gray-400 text-sm">전체 스터디</div>
                        <div className="text-2xl font-bold text-white">{studies.length}개</div>
                    </div>
                    <div className="widget-card p-4 rounded-xl">
                        <div className="text-gray-400 text-sm">모집 중</div>
                        <div className="text-2xl font-bold text-green-400">
                            {studies.filter(s => !isDeadlinePassed(s.apply_deadline)).length}개
                        </div>
                    </div>
                    <div className="widget-card p-4 rounded-xl">
                        <div className="text-gray-400 text-sm">마감됨</div>
                        <div className="text-2xl font-bold text-gray-400">
                            {studies.filter(s => isDeadlinePassed(s.apply_deadline)).length}개
                        </div>
                    </div>
                    <div className="widget-card p-4 rounded-xl">
                        <div className="text-gray-400 text-sm">태그 수</div>
                        <div className="text-2xl font-bold text-blue-400">{Object.keys(tagCounts).length}개</div>
                    </div>
                </div>

                {/* Chart */}
                {Object.keys(tagCounts).length > 0 && (
                    <div className="widget-card p-6 rounded-xl">
                        <h4 className="text-lg font-semibold text-white mb-4">태그별 스터디 분포</h4>
                        <div className="chart-container" style={{ height: '200px' }}>
                            <Doughnut 
                                data={chartData} 
                                options={{ 
                                    responsive: true, 
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            position: 'right',
                                            labels: { color: '#9ca3af' }
                                        }
                                    }
                                }} 
                            />
                        </div>
                    </div>
                )}
            </section>

            <section className="mb-8">
                <h3 className="text-2xl font-bold gradient-text mb-6">스터디 검색 및 필터</h3>
                <div className="widget-card p-6 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input 
                            type="text" 
                            name="search" 
                            placeholder="스터디명 검색" 
                            value={filters.search}
                            onChange={handleFilterChange} 
                            className="form-input bg-gray-800 border-gray-600 text-white" 
                        />
                        <select 
                            name="tag" 
                            value={filters.tag}
                            onChange={handleFilterChange} 
                            className="form-input bg-gray-800 border-gray-600 text-white"
                        >
                            <option value="">전체 태그</option>
                            {availableTags.map(tag => (
                                <option key={tag} value={tag}>{tag} ({tagCounts[tag] || 0})</option>
                            ))}
                        </select>
                        <select 
                            name="year" 
                            value={filters.year}
                            onChange={handleFilterChange} 
                            className="form-input bg-gray-800 border-gray-600 text-white"
                        >
                            <option value="">전체 연도</option>
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}년</option>
                            ))}
                        </select>
                        <select 
                            name="status" 
                            value={filters.status}
                            onChange={handleFilterChange} 
                            className="form-input bg-gray-800 border-gray-600 text-white"
                        >
                            <option value="">모집 상태</option>
                            <option value="recruiting">모집중</option>
                            <option value="closed">마감</option>
                        </select>
                    </div>
                </div>
            </section>

            <section className="mb-8">
                <h3 className="text-2xl font-bold gradient-text mb-6">
                    스터디 목록 ({filteredStudies.length}개)
                </h3>
                <div className="widget-card rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800">
                                <tr>
                                    <th className="p-4 text-left text-gray-300">스터디명</th>
                                    <th className="p-4 text-left text-gray-300">리더</th>
                                    <th className="p-4 text-left text-gray-300">태그</th>
                                    <th className="p-4 text-left text-gray-300">기간</th>
                                    <th className="p-4 text-left text-gray-300">인원</th>
                                    <th className="p-4 text-left text-gray-300">마감일</th>
                                    <th className="p-4 text-left text-gray-300">상태</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudies.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="p-8 text-center text-gray-500">
                                            {studies.length === 0 ? '등록된 스터디가 없습니다.' : '검색 결과가 없습니다.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudies.map(study => {
                                        const deadlinePassed = isDeadlinePassed(study.apply_deadline);
                                        return (
                                            <tr 
                                                key={study.id} 
                                                className="table-row border-b border-gray-700 hover:bg-gray-800 transition-colors cursor-pointer"
                                                onClick={() => navigate(`/study/${study.id}`)}
                                            >
                                                <td className="p-4">
                                                    <div className="font-semibold text-white">{study.study_name}</div>
                                                    {study.study_description && (
                                                        <div className="text-sm text-gray-400 truncate max-w-xs">
                                                            {study.study_description}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-white">{study.leader_name || '-'}</td>
                                                <td className="p-4">
                                                    {study.tag ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {study.tag.split(',').map((t, idx) => (
                                                                <span key={idx} className="px-2 py-0.5 bg-blue-600/30 text-blue-300 rounded text-xs">
                                                                    {t.trim()}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                                <td className="p-4 text-gray-300">{study.period || '-'}</td>
                                                <td className="p-4 text-white">
                                                    <span className="text-green-400">{study.members_count || 0}</span>
                                                    <span className="text-gray-500">/{study.recruit_count || '∞'}</span>
                                                </td>
                                                <td className="p-4 text-gray-300">{formatDate(study.apply_deadline)}</td>
                                                <td className="p-4">
                                                    <span className={`status-badge ${deadlinePassed ? 'status-rejected' : 'status-accepted'}`}>
                                                        {deadlinePassed ? '마감' : '모집중'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AdminStudy;
