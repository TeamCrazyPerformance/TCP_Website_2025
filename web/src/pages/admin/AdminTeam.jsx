import React, { useState, useMemo, useEffect } from 'react';
import { apiGet } from '../../api/client';
import TeamDetailModal from '../../components/modals/TeamDetailModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

const itemsPerPage = 5;

const AdminTeam = () => {
    const [teams, setTeams] = useState([]);
    const [filters, setFilters] = useState({ search: '', status: '', category: '' });
    const [sort, setSort] = useState({ column: 'title', order: 'asc' });
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // API에서 팀 목록 로드
    const loadTeams = async () => {
        try {
            setIsLoading(true);
            const data = await apiGet('/api/v1/teams');
            // API 응답 데이터 형식에 맞게 변환
            const formattedData = data.map((item) => ({
                id: item.id,
                title: item.title,
                leader: item.leader?.name || item.leader?.username || '알 수 없음',
                category: item.category,
                period: `${formatDate(item.periodStart)} - ${formatDate(item.periodEnd)}`,
                status: item.status === 'open' ? '모집중' : '마감',
                description: item.description || '',
                neededRoles: item.neededRoles || [],
                techstack: item.techStack || [],
                maxMembers: item.maxMembers || 0,
                currentMembers: item.currentMembers || 0,
            }));
            setTeams(formattedData);
        } catch (error) {
            console.error('팀 목록 로드 실패:', error);
            alert('팀 목록을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadTeams();
    }, []);

    const filteredAndSortedTeams = useMemo(() => {
        const filtered = [...teams]
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
        setCurrentPage(1); // 필터가 변경되면 1페이지로 이동
        return filtered;
    }, [teams, filters, sort]);

    const pageCount = Math.ceil(filteredAndSortedTeams.length / itemsPerPage);
    const paginatedTeams = filteredAndSortedTeams.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const stats = useMemo(() => {
        const allCategories = ['해커톤', '공모전', '프로젝트', '스터디', '기타'];
        const categoryCounts = allCategories.reduce((acc, category) => {
            acc[category] = 0;
            return acc;
        }, {});
        
        teams.forEach(team => {
            if (categoryCounts.hasOwnProperty(team.category)) {
                categoryCounts[team.category]++;
            } else {
                categoryCounts[team.category] = 1;
            }
        });
        
        return {
            total: teams.length,
            recruiting: teams.filter(t => t.status === '모집중').length,
            closed: teams.filter(t => t.status === '마감').length,
            categoryDistribution: categoryCounts,
        };
    }, [teams]);

    // 날짜 포맷 함수
    const formatDate = (value, separator = '.') => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${separator}${month}${separator}${day}`;
    };

    // 상태 정규화 함수
    const normalizeStatus = (status) => {
        if (status === 'open') return '모집중';
        if (status === 'closed') return '마감';
        return status || '모집중';
    };

    // 실행 유형 정규화 함수
    const normalizeExecutionType = (type) => {
        if (type === 'ONLINE' || type === 'online') return '온라인';
        if (type === 'OFFLINE' || type === 'offline') return '오프라인';
        if (type === 'HYBRID' || type === 'hybrid') return '온/오프라인 혼합';
        return '온라인';
    };

    // 태그/스택 분리 함수
    const splitTags = (value) => {
        if (!value) return [];
        return value
            .split(/[,\s/|]+/)
            .map((item) => item.trim())
            .filter(Boolean);
    };

    // 목표 분리 함수
    const splitGoals = (value) => {
        if (!value) return [];
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    };

    // API 응답을 TeamDetailModal에 맞는 형식으로 변환
    const mapTeamForModal = (team) => {
        const roles = team.roles || [];
        const neededRoles = roles.length
            ? roles
                .map((role) => `${role.roleName} ${role.recruitCount}명`)
                .join(', ')
            : '모집 역할 미정';
        const tags = [
            ...new Set([...splitTags(team.tag), ...splitTags(team.techStack)]),
        ];
        const leaderName = team.leader?.name || team.leader?.username || '팀 리더';
        const leaderAvatar = team.leader?.profile_image || 
            'https://via.placeholder.com/40/A8C5E6/FFFFFF?text=L';
        const period = `${formatDate(team.periodStart)} – ${formatDate(
            team.periodEnd
        )}`;
        const deadline = team.deadline ? formatDate(team.deadline, '-') : '';
        const links = team.link ? [team.link] : [];
        const goals = splitGoals(team.goals || '').length
            ? splitGoals(team.goals || '')
            : ['프로젝트 완수'];
        const selectionProcess = team.selectionProc || '지원서 검토 후 안내';
        const techStack = splitTags(team.techStack);
        const images = team.projectImage && team.projectImage.trim()
            ? [team.projectImage]
            : [
                'https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=2020&auto=format&fit=crop',
            ];

        return {
            id: team.id,
            leaderId: team.leader?.id,
            title: team.title,
            category: team.category,
            leader: {
                name: leaderName,
                avatar: leaderAvatar,
                role: '팀 리더',
            },
            status: normalizeStatus(team.status),
            period,
            periodStart: team.periodStart,
            periodEnd: team.periodEnd,
            deadline,
            deadlineDate: team.deadline,
            description: team.description,
            fullDescription: team.description,
            neededRoles,
            roles: team.roles,
            participants: [
                {
                    name: leaderName,
                    role: '팀 리더',
                    avatar: leaderAvatar,
                },
            ],
            techStack,
            techStackRaw: team.techStack,
            tags,
            tag: team.tag,
            tagsRaw: team.tag,
            images,
            projectImage: team.projectImage,
            links,
            link: team.link,
            linksRaw: team.link,
            location: normalizeExecutionType(team.executionType),
            executionType: team.executionType,
            executionTypeRaw: team.executionType,
            selectionProcess,
            selectionProc: team.selectionProc,
            contact: team.contact || '연락처 없음',
            goals,
            goalsRaw: team.goals,
            rolesRaw: team.roles,
            createdAt: team.createdAt,
        };
    };

    // 팀 상세보기
    const handleViewTeam = async (teamId) => {
        try {
            const data = await apiGet(`/api/v1/teams/${teamId}`);
            setSelectedTeam(mapTeamForModal(data));
            setIsModalOpen(true);
        } catch (error) {
            console.error('팀 상세정보 로드 실패:', error);
            alert('팀 상세정보를 불러오는데 실패했습니다.');
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedTeam(null);
    };

    return (
        <div className="container mx-auto max-w-7xl">
            {/* Statistics Dashboard */}
            <section className="mb-8">
                <h3 className="orbitron text-3xl font-bold gradient-text mb-6">팀 통계</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="widget-card p-4 rounded-xl">
                        <div className="text-gray-400 text-sm">총 팀 수</div>
                        <div className="text-2xl font-bold text-white">{stats.total}개</div>
                    </div>
                    <div className="widget-card p-4 rounded-xl">
                        <div className="text-gray-400 text-sm">모집중</div>
                        <div className="text-2xl font-bold text-green-400">{stats.recruiting}개</div>
                    </div>
                    <div className="widget-card p-4 rounded-xl">
                        <div className="text-gray-400 text-sm">마감</div>
                        <div className="text-2xl font-bold text-red-400">{stats.closed}개</div>
                    </div>
                    <div className="widget-card p-4 rounded-xl">
                        <div className="text-gray-400 text-sm mb-2">카테고리 분포</div>
                        <div className="space-y-1.5">
                            {['해커톤', '공모전', '프로젝트', '스터디', '기타'].map((category) => (
                                <div key={category} className="flex justify-between items-center text-xs">
                                    <span className="text-gray-300">{category}</span>
                                    <span className="font-semibold text-white">{stats.categoryDistribution[category] || 0}개</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Search and Filter Section */}
            <section className="mb-8">
                <div className="search-filter-card p-6 rounded-xl">
                    <h3 className="orbitron text-3xl font-bold gradient-text mb-6">팀 관리</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="searchInput" className="block text-sm font-medium text-gray-300 mb-2">검색</label>
                            <input
                                type="text"
                                id="searchInput"
                                className="form-input"
                                placeholder="팀명 검색"
                                value={filters.search}
                                onChange={(e) => setFilters({...filters, search: e.target.value})}
                            />
                        </div>
                        <div>
                            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-300 mb-2">상태</label>
                            <select
                                id="statusFilter"
                                className="form-input"
                                value={filters.status}
                                onChange={(e) => setFilters({...filters, status: e.target.value})}
                            >
                                <option value="" className="bg-gray-800 text-white">모든 상태</option>
                                <option value="모집중" className="bg-gray-800 text-white">모집중</option>
                                <option value="마감" className="bg-gray-800 text-white">마감</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="categoryFilter" className="block text-sm font-medium text-gray-300 mb-2">카테고리</label>
                            <select
                                id="categoryFilter"
                                className="form-input"
                                value={filters.category}
                                onChange={(e) => setFilters({...filters, category: e.target.value})}
                            >
                                <option value="" className="bg-gray-800 text-white">모든 카테고리</option>
                                <option value="해커톤" className="bg-gray-800 text-white">해커톤</option>
                                <option value="공모전" className="bg-gray-800 text-white">공모전</option>
                                <option value="프로젝트" className="bg-gray-800 text-white">프로젝트</option>
                                <option value="스터디" className="bg-gray-800 text-white">스터디</option>
                                <option value="기타" className="bg-gray-800 text-white">기타</option>
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            {/* Table Section */}
            <section className="mb-8">
                <div className="widget-card rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-800">
                                <tr>
                                    <th className="p-4 text-center" style={{width: '300px'}}>팀명</th>
                                    <th className="p-4 text-center" style={{width: '120px'}}>리더</th>
                                    <th className="p-4 text-center" style={{width: '100px'}}>카테고리</th>
                                    <th className="p-4 text-center" style={{width: '200px'}}>기간</th>
                                    <th className="p-4 text-center" style={{width: '100px'}}>상태</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-gray-400">
                                            <i className="fas fa-spinner fa-spin mr-2"></i>
                                            로딩 중...
                                        </td>
                                    </tr>
                                ) : filteredAndSortedTeams.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-gray-400">
                                            팀이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedTeams.map(team => (
                                    <tr key={team.id} className="table-row border-b border-gray-700">
                                        <td className="p-4 text-center">
                                            <div 
                                                className="font-semibold text-white cursor-pointer hover:text-blue-300"
                                                onClick={() => handleViewTeam(team.id)}
                                            >
                                                {team.title}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center text-gray-300">{team.leader}</td>
                                        <td className="p-4 text-center">
                                            <span className={`status-badge whitespace-nowrap category-${team.category.toLowerCase()}`}>
                                                {team.category}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-gray-300">{team.period}</td>
                                        <td className="p-4 text-center">
                                            <span className={`status-badge status-${team.status === '모집중' ? 'recruiting' : 'closed'}`}>
                                                {team.status}
                                            </span>
                                        </td>
                                    </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Pagination */}
            <section className="flex justify-center">
                <div className="flex items-center space-x-2">
                    <button
                        className="px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    {[...Array(pageCount)].map((_, i) => (
                        <button
                            key={i}
                            className={`px-4 py-2 rounded-lg font-bold ${
                                currentPage === i + 1
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors'
                            }`}
                            onClick={() => setCurrentPage(i + 1)}
                        >
                            {i + 1}
                        </button>
                    ))}
                    <button
                        className="px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                        onClick={() => setCurrentPage((prev) => Math.min(pageCount, prev + 1))}
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                </div>
            </section>

            {/* Detail Modal */}
            <TeamDetailModal
                isOpen={isModalOpen}
                onClose={closeModal}
                team={selectedTeam}
                isAdminView={true}
            />
        </div>
    );
};

export default AdminTeam;
