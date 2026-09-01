import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import RecruitTeamModal from '../components/modals/RecruitTeamModal';
import TeamDetailModal from '../components/modals/TeamDetailModal';
import PublicPageHero from '../components/public/PublicPageHero';
import TagMultiSelect from '../components/public/TagMultiSelect';
import { useScrollReveal } from '../hooks/useScrollReveal';
import TeamCard from '../components/TeamCard';
import { tagColorClass } from '../utils/helpers';
import { apiGet, apiPatch, apiDelete } from '../api/client';
import { initialTeams as developmentTeams } from '../data/teams';

const TAGS = [
  'AI',
  '해커톤',
  '프론트엔드',
  '백엔드',
  '공모전',
  '초보환영',
  '프로젝트',
  '알고리즘',
];

const formatDate = (value, separator = '.') => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${separator}${month}${separator}${day}`;
};

const normalizeStatus = (status) => {
  if (status === 'open') return '모집중';
  if (status === 'closed') return '모집완료';
  return status || '모집중';
};

const normalizeExecutionType = (type) => {
  if (type === 'online') return '온라인';
  if (type === 'offline') return '오프라인';
  if (type === 'hybrid') return '온/오프라인 혼합';
  return '온라인';
};

const splitTags = (value) => {
  if (!value) return [];
  return value
    .split(/[,\s/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const splitGoals = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const mapApiTeam = (team) => {
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
    roles: team.roles,
    rolesRaw: team.roles,
    createdAt: team.createdAt,
  };
};

export default function Team() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [applicationStatuses, setApplicationStatuses] = useState({});

  const [searchTerm, setSearchTerm] = useState('');

  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [activeTags, setActiveTags] = useState([]);
  const [sortBy, setSortBy] = useState('latest');

  const [isRecruitModalOpen, setIsRecruitModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [recruitModalInitialData, setRecruitModalInitialData] = useState(null);

  const filteredTeams = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let filtered = teams.filter((t) => {
      const searchableValues = [
        t.title,
        t.description,
        t.fullDescription,
        t.category,
        t.status,
        t.neededRoles,
        t.location,
        t.leader?.name,
        ...(t.tags || []),
        ...(t.techStack || []),
      ];
      const searchMatch =
        !term ||
        searchableValues.some((value) =>
          String(value || '').toLowerCase().includes(term)
        );
      const statusMatch = !filterStatus || t.status === filterStatus;
      const categoryMatch = !filterCategory || t.category === filterCategory;
      const tagButtonMatch =
        !activeTags.length ||
        (t.tags || []).some((tag) => activeTags.includes(tag));

      return (
        searchMatch &&

        statusMatch &&
        categoryMatch &&
        tagButtonMatch
      );
    });

    if (sortBy === 'latest') {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    return filtered;
  }, [
    teams,
    searchTerm,

    filterStatus,
    filterCategory,
    activeTags,
    sortBy,
  ]);

  const handleTagClick = (tag) => {
    setActiveTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((currentTag) => currentTag !== tag)
        : [...currentTags, tag]
    );
  };

  useScrollReveal(
    '.recruitment-card',
    filteredTeams.map((team) => team.id).join(','),
  );

  useEffect(() => {
    let isMounted = true;

    const fetchTeams = async () => {
      try {
        setIsLoading(true);
        const data = await apiGet('/api/v1/teams');
        if (isMounted) {
          const mappedTeams = (data || []).map(mapApiTeam);
          const visibleTeams =
            process.env.NODE_ENV === 'development' && mappedTeams.length === 0
              ? developmentTeams
              : mappedTeams;
          setTeams(visibleTeams);
          setErrorMessage('');
        }
      } catch (error) {
        if (isMounted) {
          if (process.env.NODE_ENV === 'development') {
            setTeams(developmentTeams);
            setErrorMessage('');
          } else {
            setErrorMessage(error.message || '팀 정보를 불러오지 못했습니다.');
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTeams();

    return () => {
      isMounted = false;
    };
  }, []);

  // 지원 상태 조회
  useEffect(() => {
    if (!user || teams.length === 0) return;

    const fetchApplicationStatuses = async () => {
      const statusMap = {};

      await Promise.all(
        teams.map(async (team) => {
          try {
            const data = await apiGet(`/api/v1/teams/${team.id}/application-status`);
            statusMap[team.id] = data;
          } catch (error) {
            // 에러 무시 (401 등)
            statusMap[team.id] = { hasApplied: false, applicationInfo: null };
          }
        })
      );

      setApplicationStatuses(statusMap);
    };

    fetchApplicationStatuses();
  }, [user, teams]);

  const handleApplicationStatusChange = (teamId, newStatus) => {
    setApplicationStatuses(prev => ({
      ...prev,
      [teamId]: newStatus
    }));
  };

  // ---- Modal a11y (ESC & backdrop close) ----
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setIsRecruitModalOpen(false);
        setIsDetailModalOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleOpenDetail = (team) => {
    setSelectedTeam(team);
    setIsDetailModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedTeam(null);
    document.body.style.overflow = 'auto';
  };

  const handleOpenRecruit = () => {
    setRecruitModalInitialData(null);
    setIsRecruitModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseRecruit = () => {
    setIsRecruitModalOpen(false);
    setRecruitModalInitialData(null);
    document.body.style.overflow = 'auto';
  };

  const handleAddTeam = (newTeam) => {
    setTeams((prevTeams) => [newTeam, ...prevTeams]);
  };

  const handleUpdateTeam = (updatedTeam) => {
    setTeams((prevTeams) =>
      prevTeams.map((t) => (t.id === updatedTeam.id ? updatedTeam : t))
    );
  };

  const handleEditTeam = (team) => {
    const initialData = {
      id: team.id,
      title: team.title,
      category: team.category,
      periodStart: team.periodStart,
      periodEnd: team.periodEnd,
      deadlineDate: team.deadlineDate || team.deadline,
      description: team.description,
      techStackRaw: team.techStackRaw || team.techStack,
      goals: team.goalsRaw || team.goals,
      executionTypeRaw: team.executionTypeRaw || team.executionType,
      selectionProcess: team.selectionProcess,
      contact: team.contact,
      linksRaw: team.linksRaw || team.link,
      tagsRaw: team.tagsRaw || team.tag,
      projectImage: team.images?.[0] || team.projectImage || '',
      rolesRaw: team.rolesRaw || team.roles || [],
    };
    setRecruitModalInitialData(initialData);
    setIsRecruitModalOpen(true);
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('정말로 이 팀 모집글을 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/api/v1/teams/${teamId}`);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      alert('삭제되었습니다.');
    } catch (err) {
      alert(err.message || '삭제 실패');
    }
  };

  const handleToggleStatus = async (team) => {
    const newStatus = team.status === '모집중' ? 'closed' : 'open';
    const newStatusText = newStatus === 'open' ? '모집중' : '모집완료';

    try {
      await apiPatch(`/api/v1/teams/${team.id}/status`, { status: newStatus });
      setTeams((prev) =>
        prev.map((t) =>
          t.id === team.id ? { ...t, status: newStatusText } : t
        )
      );
    } catch (err) {
      alert(err.message || '상태 변경 실패');
    }
  };

  return (
    <>
      <PublicPageHero
        icon={<i className="fas fa-users text-white text-3xl"></i>}
        iconClassName="team-hero-icon"
        title="Find Your Team"
        lead="함께 성장하고 도전할 최고의 팀원을 찾아보세요."
        description={(
          <>
            TCP 동아리원뿐만 아니라 누구나 프로젝트, 스터디, 해커톤과 같은
            <br className="team-description-desktop-break" />
            {' '}여러 활동의 팀원을 모집하고, 지원할 수 있어요.
          </>
        )}
        action={(
          <button
            onClick={handleOpenRecruit}
            className="team-hero-action cta-button primary-cta-text inline-flex items-center justify-center px-6 py-3 rounded-lg text-lg font-bold transition-transform transform hover:scale-105"
            aria-label="팀 모집 시작하기"
          >
            <i className="fas fa-plus mr-2" />팀 모집 시작하기
          </button>
        )}
      />

      <section className="py-16 bg-gradient-to-b from-transparent to-gray-900">
        <div className="container site-content-container mx-auto px-4">
          <div className="service-filter-panel mb-10 rounded-xl shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Search */}
          <div>
            <div className="relative">
              <input
                id="search"
                type="text"
                aria-label="팀 모집글 검색"
                placeholder="제목, 설명, 태그, 역할, 리더로 검색"
                className="service-filter-control team-filter-control team-filter-input py-2 pl-10 pr-4 focus:ring-2 focus:ring-accent-blue focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <i
                className="search-field-icon search-field-icon-left fas fa-search text-gray-500"
                aria-hidden="true"
              />
            </div>
          </div>
          {/* Status */}
          <div className="team-filter-select-wrap">
            <select
              id="filter-status"
              aria-label="모집 상태"
              className="service-filter-control team-filter-control team-filter-select py-2 px-4 focus:ring-2 focus:ring-accent-blue focus:outline-none"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">모든 상태</option>
              <option value="모집중">모집중</option>
              <option value="모집완료">모집완료</option>
            </select>
            <i className="team-filter-chevron fas fa-chevron-down" aria-hidden="true" />
          </div>
          {/* Category */}
          <div className="team-filter-select-wrap">
            <select
              id="filter-category"
              aria-label="카테고리"
              className="service-filter-control team-filter-control team-filter-select py-2 px-4 focus:ring-2 focus:ring-accent-blue focus:outline-none"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">모든 카테고리</option>
              <option value="해커톤">해커톤</option>
              <option value="공모전">공모전</option>
              <option value="프로젝트">프로젝트</option>
              <option value="스터디">스터디</option>
              <option value="기타">기타</option>
            </select>
            <i className="team-filter-chevron fas fa-chevron-down" aria-hidden="true" />
          </div>
          {/* Sort by */}
          <div className="team-filter-select-wrap">
            <select
              id="sort-by"
              aria-label="날짜순 정렬"
              className="service-filter-control team-filter-control team-filter-select py-2 px-4 focus:ring-2 focus:ring-accent-blue focus:outline-none"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="latest">최신순</option>
              <option value="oldest">오래된순</option>
            </select>
            <i className="team-filter-chevron fas fa-chevron-down" aria-hidden="true" />
          </div>
        </div>
        <TagMultiSelect
          className="team-tag-filter"
          ariaLabel="팀 모집 태그 필터"
          tags={TAGS}
          selectedTags={activeTags}
          onToggle={handleTagClick}
          onReset={() => setActiveTags([])}
          getTagClassName={tagColorClass}
        />
          </div>

          <div id="recruitment-grid" className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isLoading && (
          <div className="col-span-full text-center text-gray-400 py-12">
            팀 모집글을 불러오는 중...
          </div>
        )}
        {errorMessage && !isLoading && (
          <div className="col-span-full text-center text-red-400 py-12">
            {errorMessage}
          </div>
        )}
        {!isLoading && !errorMessage && filteredTeams.length === 0 && (
          <div className="col-span-full text-center text-gray-400 py-12">
            현재 모집 중인 팀이 없습니다.
          </div>
        )}
        {!isLoading &&
          !errorMessage &&
          filteredTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              currentUser={user}
              applicationStatus={applicationStatuses[team.id]}
              onOpenDetail={handleOpenDetail}
              onEdit={handleEditTeam}
              onDelete={handleDeleteTeam}
              onStatusChange={handleToggleStatus}
            />
          ))}
          </div>
        </div>
      </section>

      <RecruitTeamModal
        isOpen={isRecruitModalOpen}
        onClose={handleCloseRecruit}
        onAddTeam={handleAddTeam}
        onUpdateTeam={handleUpdateTeam}
        initialData={recruitModalInitialData}
      />

      <TeamDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
        team={selectedTeam}
        onApplicationStatusChange={handleApplicationStatusChange}
      />
    </>
  );
}
