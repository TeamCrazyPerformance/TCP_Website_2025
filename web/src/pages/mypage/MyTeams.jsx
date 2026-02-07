import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import TeamCard from '../../components/TeamCard';
import TeamDetailModal from '../../components/modals/TeamDetailModal';
import RecruitTeamModal from '../../components/modals/RecruitTeamModal';
import { apiGet, apiPatch, apiDelete } from '../../api/client';

const toArray = (value) => (Array.isArray(value) ? value : []);

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
  if (status === 'OPEN' || status === 'open') return '모집중';
  if (status === 'CLOSED' || status === 'closed') return '모집완료';
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
  if (Array.isArray(value)) return value;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const mapTeam = (team, teamCategory) => {
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
    teamCategory, // 'recruiting', 'applied', 'completed'
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

const normalizeTeamsResponse = (data) => {
  if (Array.isArray(data)) {
    return data.map((team) => mapTeam(team, 'unknown'));
  }

  const recruiting = toArray(data?.recruitingTeams).map((team) =>
    mapTeam(team, 'recruiting')
  );
  const applied = toArray(data?.appliedTeams).map((team) =>
    mapTeam(team, 'applied')
  );
  const completed = toArray(data?.completedTeams).map((team) =>
    mapTeam(team, 'completed')
  );

  return {
    recruiting,
    applied,
    completed,
    all: [...recruiting, ...applied, ...completed],
  };
};


function MyTeams() {
  const { user } = useAuth();
  const [teamsData, setTeamsData] = useState({ recruiting: [], applied: [], completed: [], all: [] });
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState('all');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isRecruitModalOpen, setIsRecruitModalOpen] = useState(false);
  const [recruitModalInitialData, setRecruitModalInitialData] = useState(null);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true);
        const data = await apiGet('/api/v1/mypage/teams');
        setTeamsData(normalizeTeamsResponse(data));
      } catch (err) {
        console.error('Failed to fetch teams:', err);
        setTeamsData({ recruiting: [], applied: [], completed: [], all: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  const handleOpenDetail = async (team) => {
    try {
      // 백엔드에서 팀 상세 정보 가져오기 (리더인 경우 지원자 정보 포함)
      const detailData = await apiGet(`/api/v1/mypage/teams/${team.id}`);
      
      // 백엔드 데이터를 팀 카드 형식으로 변환
      const detailedTeam = mapTeam(detailData, team.teamCategory);
      
      // 지원자 정보가 있으면 추가
      if (detailData.applicants) {
        detailedTeam.applicants = detailData.applicants;
      }
      
      setSelectedTeam(detailedTeam);
      setIsDetailModalOpen(true);
      document.body.style.overflow = 'hidden';
    } catch (error) {
      console.error('Failed to fetch team detail:', error);
      // 에러가 발생해도 기본 정보로 모달 열기
      setSelectedTeam(team);
      setIsDetailModalOpen(true);
      document.body.style.overflow = 'hidden';
    }
  };

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedTeam(null);
    document.body.style.overflow = 'auto';
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
    document.body.style.overflow = 'hidden';
  };

  const handleCloseRecruitModal = () => {
    setIsRecruitModalOpen(false);
    setRecruitModalInitialData(null);
    document.body.style.overflow = 'auto';
  };

  const handleUpdateTeam = async (updatedTeam) => {
    // 팀 목록 다시 불러오기
    const data = await apiGet('/api/v1/mypage/teams');
    setTeamsData(normalizeTeamsResponse(data));
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('정말로 이 팀 모집글을 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/api/v1/teams/${teamId}`);
      const data = await apiGet('/api/v1/mypage/teams');
      setTeamsData(normalizeTeamsResponse(data));
      alert('삭제되었습니다.');
    } catch (err) {
      alert(err.message || '삭제 실패');
    }
  };

  const handleToggleStatus = async (team) => {
    const newStatus = team.status === '모집중' ? 'closed' : 'open';
    try {
      await apiPatch(`/api/v1/teams/${team.id}/status`, { status: newStatus });
      const data = await apiGet('/api/v1/mypage/teams');
      setTeamsData(normalizeTeamsResponse(data));
    } catch (err) {
      alert(err.message || '상태 변경 실패');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl p-6">
        <div className="text-center text-gray-400">팀 목록을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl">
      {/* Page Title and Stats */}
      <div className="mb-8">
        <h3 className="orbitron text-3xl font-bold gradient-text mb-2">
          팀 구성 이력
        </h3>
        <p className="text-gray-400 mb-6">
          TCP에서 참여했던 모든 팀 활동을 확인할 수 있습니다.
        </p>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="stat-card p-4 rounded-lg text-center">
            <div className="text-2xl font-bold gradient-text">
              {teamsData.all.length}
            </div>
            <div className="text-sm text-gray-400">총 참여 팀</div>
          </div>
          <div className="stat-card p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-400">
              {teamsData.recruiting.length}
            </div>
            <div className="text-sm text-gray-400">내가 모집중인 팀</div>
          </div>
          <div className="stat-card p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-400">
              {teamsData.applied.length}
            </div>
            <div className="text-sm text-gray-400">내가 지원한 팀</div>
          </div>
          <div className="stat-card p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-400">
              {teamsData.completed.length}
            </div>
            <div className="text-sm text-gray-400">구성 완료</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('recruiting')}
            className={`filter-tab ${filter === 'recruiting' ? 'active' : ''}`}
          >
            내가 모집중인 팀
          </button>
          <button
            onClick={() => setFilter('applied')}
            className={`filter-tab ${filter === 'applied' ? 'active' : ''}`}
          >
            내가 지원한 팀
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
          >
            구성 완료
          </button>
        </div>
      </div>

      {/* Team List by Category */}
      {(filter === 'all' || filter === 'recruiting') && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-2xl font-bold text-white flex items-center">
              <i className="fas fa-bullhorn text-blue-400 mr-3"></i>
              내가 모집중인 팀
              <span className="ml-2 text-sm bg-blue-500 bg-opacity-20 px-2 py-1 rounded-full text-blue-400">
                {teamsData.recruiting.length}
              </span>
            </h4>
          </div>
          {teamsData.recruiting.length === 0 ? (
            <div className="text-center text-gray-500 py-8">모집중인 팀이 없습니다.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamsData.recruiting.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  currentUser={user}
                  applicationStatus={null}
                  onOpenDetail={handleOpenDetail}
                  onEdit={handleEditTeam}
                  onDelete={handleDeleteTeam}
                  onStatusChange={handleToggleStatus}
                  isMyPage={true}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {(filter === 'all' || filter === 'applied') && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-2xl font-bold text-white flex items-center">
              <i className="fas fa-paper-plane text-purple-400 mr-3"></i>
              내가 지원한 팀
              <span className="ml-2 text-sm bg-purple-500 bg-opacity-20 px-2 py-1 rounded-full text-purple-400">
                {teamsData.applied.length}
              </span>
            </h4>
          </div>
          {teamsData.applied.length === 0 ? (
            <div className="text-center text-gray-500 py-8">지원한 팀이 없습니다.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamsData.applied.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  currentUser={user}
                  applicationStatus={{ hasApplied: true, applicationInfo: null }}
                  onOpenDetail={handleOpenDetail}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onStatusChange={() => {}}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {(filter === 'all' || filter === 'completed') && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-2xl font-bold text-white flex items-center">
              <i className="fas fa-check-circle text-green-400 mr-3"></i>
              구성 완료된 팀
              <span className="ml-2 text-sm bg-green-500 bg-opacity-20 px-2 py-1 rounded-full text-green-400">
                {teamsData.completed.length}
              </span>
            </h4>
          </div>
          {teamsData.completed.length === 0 ? (
            <div className="text-center text-gray-500 py-8">완료된 팀이 없습니다.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamsData.completed.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  currentUser={user}
                  applicationStatus={null}
                  onOpenDetail={handleOpenDetail}
                  onEdit={handleEditTeam}
                  onDelete={handleDeleteTeam}
                  onStatusChange={handleToggleStatus}
                  isMyPage={true}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Team Detail Modal */}
      <TeamDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
        team={selectedTeam}
        onApplicationStatusChange={() => {}}
        isMyPage={true}
      />

      {/* Recruit Team Modal */}
      <RecruitTeamModal
        isOpen={isRecruitModalOpen}
        onClose={handleCloseRecruitModal}
        onAddTeam={() => {}}
        onUpdateTeam={handleUpdateTeam}
        initialData={recruitModalInitialData}
      />
    </div>
  );
}

export default MyTeams;
