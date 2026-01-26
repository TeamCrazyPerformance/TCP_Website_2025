import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiGet } from '../../api/client';
import {
  faCalendarAlt,
  faTrophy,
  faUserTag,
  faTimes,
  faMedal,
  faLink,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';

function MyTeams() {
  // 팀 목록 데모 데이터
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true);
        const data = await apiGet('/api/v1/mypage/teams');
        setTeams(data || []);
      } catch (err) {
        console.error('Failed to fetch teams:', err);
        // Use empty array on error
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  const filteredTeams = teams.filter((team) => {
    if (filter === 'all') return true;
    return team.status === filter;
  });

  const openTeamModal = (teamId) => {
    const team = teams.find((t) => t.id === teamId);
    setSelectedTeam(team);
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTeam(null);
    document.body.style.overflow = 'auto';
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
              {teams.length}
            </div>
            <div className="text-sm text-gray-400">총 참여 팀</div>
          </div>
          <div className="stat-card p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-400">
              {teams.filter((t) => t.status === 'ongoing').length}
            </div>
            <div className="text-sm text-gray-400">팀 구성중</div>
          </div>
          <div className="stat-card p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-400">
              {teams.filter((t) => t.status === 'completed').length}
            </div>
            <div className="text-sm text-gray-400">구성 완료</div>
          </div>
          <div className="stat-card p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-400">
              {
                teams.filter(
                  (t) => t.role.includes('리더') || t.role.includes('팀장')
                ).length
              }
            </div>
            <div className="text-sm text-gray-400">팀 리더 경험</div>
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
            onClick={() => setFilter('ongoing')}
            className={`filter-tab ${filter === 'ongoing' ? 'active' : ''}`}
          >
            팀 구성중
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
          >
            구성 완료
          </button>
        </div>
      </div>

      {/* Team List */}
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => (
            <div
              key={team.id}
              className={`team-card p-6 rounded-xl card-hover ${team.status === 'completed' ? 'completed' : ''}`}
              onClick={() => openTeamModal(team.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <h5 className="orbitron text-lg font-bold text-white">
                  {team.title}
                </h5>
                <span
                  className={`status-badge ${team.status === 'ongoing' ? 'status-ongoing' : 'status-completed'}`}
                >
                  {team.status === 'ongoing' ? '구성중' : '완료'}
                </span>
              </div>
              <div className="space-y-3 mb-4">
                <div className="flex items-center text-sm text-gray-300">
                  <FontAwesomeIcon
                    icon={faCalendarAlt}
                    className="text-blue-400 w-4"
                  />
                  <span className="ml-2">{team.period}</span>
                </div>
                <div className="flex items-center text-sm text-gray-300">
                  <FontAwesomeIcon
                    icon={faTrophy}
                    className="text-yellow-400 w-4"
                  />
                  <span className="ml-2">{team.event}</span>
                </div>
                <div className="flex items-center text-sm text-gray-300">
                  <FontAwesomeIcon
                    icon={faUserTag}
                    className="text-purple-400 w-4"
                  />
                  <span className="ml-2">역할: {team.role}</span>
                </div>
              </div>
              <div className="mb-4">
                <div className="text-sm text-gray-400 mb-2">
                  팀원 ({team.members.length}/{team.members.length}명)
                </div>
                <div className="flex items-center">
                  {team.members.map((member, index) => (
                    <img
                      key={index}
                      src={member.avatar}
                      alt={member.name}
                      className="member-avatar"
                      title={`${member.name} (${member.role})`}
                    />
                  ))}
                  {team.status === 'ongoing' && (
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center text-gray-500 text-xs">
                      +1
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap mb-4">
                {team.techStack.map((tag, index) => (
                  <span key={index} className="role-badge">
                    {tag}
                  </span>
                ))}
              </div>
              {team.status === 'ongoing' && (
                <div className="text-xs text-gray-500">
                  <FontAwesomeIcon
                    icon={faInfoCircle}
                    className="text-yellow-400"
                  />
                  <span className="ml-1">{team.recruiting}</span>
                </div>
              )}
              {team.status === 'completed' && (
                <div className="text-xs text-green-400">
                  <FontAwesomeIcon icon={faMedal} className="text-yellow-400" />
                  <span className="ml-1">{team.achievement}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Team Detail Modal */}
      {isModalOpen && selectedTeam && (
        <div id="team-modal" className="modal show" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3
                id="modal-title"
                className="orbitron text-2xl font-bold gradient-text"
              >
                {selectedTeam.title}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-semibold text-white mb-3">기본 정보</h4>
                  <div className="space-y-2 text-sm text-gray-300">
                    <div>
                      <strong>상태:</strong>{' '}
                      <span
                        className={`status-badge ${selectedTeam.status === 'ongoing' ? 'status-ongoing' : 'status-completed'}`}
                      >
                        {selectedTeam.status === 'ongoing' ? '구성중' : '완료'}
                      </span>
                    </div>
                    <div>
                      <strong>기간:</strong> {selectedTeam.period}
                    </div>
                    <div>
                      <strong>대회/프로젝트:</strong> {selectedTeam.event}
                    </div>
                    <div>
                      <strong>내 역할:</strong> {selectedTeam.role}
                    </div>
                    {selectedTeam.achievement && (
                      <div>
                        <strong>성과:</strong>{' '}
                        <span className="text-green-400">
                          {selectedTeam.achievement}
                        </span>
                      </div>
                    )}
                    {selectedTeam.recruiting && (
                      <div>
                        <strong>모집:</strong>{' '}
                        <span className="text-yellow-400">
                          {selectedTeam.recruiting}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-3">기술 스택</h4>
                  <div className="flex flex-wrap">
                    {selectedTeam.techStack.map((tech, index) => (
                      <span key={index} className="role-badge">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold text-white mb-3">팀 소개</h4>
                <p className="text-gray-300">{selectedTeam.description}</p>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold text-white mb-3">팀원 정보</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedTeam.members.map((member, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-3 p-3 bg-gray-800 bg-opacity-50 rounded-lg"
                    >
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <div className="font-semibold text-white">
                          {member.name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {member.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTeam.goals && selectedTeam.goals.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-white mb-3">주요 목표</h4>
                  <ul className="list-disc list-inside text-gray-300 space-y-1">
                    {selectedTeam.goals.map((goal, index) => (
                      <li key={index}>{goal}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedTeam.links && selectedTeam.links.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-white mb-3">관련 링크</h4>
                  <div className="space-y-2">
                    {selectedTeam.links.map((link, index) => (
                      <a
                        key={index}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-blue-400 hover:text-blue-300 text-sm transition-colors"
                      >
                        <FontAwesomeIcon icon={faLink} className="mr-2" />
                        {link}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyTeams;
