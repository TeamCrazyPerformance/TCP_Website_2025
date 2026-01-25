import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
  const [teams] = useState([
    {
      id: 'team1',
      title: 'AI 해커톤 팀',
      event: 'AI Creativity Hackathon',
      role: '팀 리더',
      period: '2024.07.14 - 2024.07.18',
      members: [
        {
          name: '김TCP',
          role: '팀 리더',
          avatar: 'https://via.placeholder.com/32/A8C5E6/FFFFFF?text=김',
        },
        {
          name: '이Performance',
          role: '기획',
          avatar: 'https://via.placeholder.com/32/C5A8E6/FFFFFF?text=이',
        },
        {
          name: '박Developer',
          role: '프론트엔드',
          avatar: 'https://via.placeholder.com/32/A8E6C5/FFFFFF?text=박',
        },
      ],
      status: 'ongoing',
      recruiting: '백엔드 개발자 1명 모집 중',
      techStack: ['AI', '기획', '프론트엔드'],
      description:
        'AI 모델을 활용해 사회 문제를 해결하는 창의적인 솔루션을 개발하는 해커톤 팀입니다.',
      goals: ['AI 모델 개발', '웹 서비스 구현', '사회 문제 해결 방안 제시'],
      links: [
        'https://github.com/ai-hackathon-team',
        'https://notion.so/ai-hackathon',
      ],
    },
    {
      id: 'team2',
      title: '캠퍼스 앱 개발팀',
      event: '대학생 연합 프로젝트',
      role: '프론트엔드 개발자',
      period: '2024.09.01 - 2024.12.15',
      members: [
        {
          name: '최Leader',
          role: '팀장',
          avatar: 'https://via.placeholder.com/32/E6A8C5/FFFFFF?text=최',
        },
        {
          name: '김TCP',
          role: '프론트엔드',
          avatar: 'https://via.placeholder.com/32/A8C5E6/FFFFFF?text=김',
        },
        {
          name: '정Designer',
          role: '디자인',
          avatar: 'https://via.placeholder.com/32/C5A8E6/FFFFFF?text=정',
        },
        {
          name: '강Backend',
          role: '백엔드',
          avatar: 'https://via.placeholder.com/32/A8E6C5/FFFFFF?text=강',
        },
      ],
      status: 'ongoing',
      recruiting: '프론트엔드 개발자 1명 추가 모집 중',
      techStack: ['React', 'React Native', 'UI/UX'],
      description:
        '대학생들의 캠퍼스 생활을 편리하게 만들어 줄 모바일 앱을 개발하는 프로젝트입니다.',
      goals: ['모바일 앱 개발', '사용자 경험 최적화', '실제 서비스 배포'],
      links: ['https://github.com/campus-app-team'],
    },
    {
      id: 'team3',
      title: 'Software Maestro 팀',
      event: 'Software Maestro 14기',
      role: '백엔드 개발자',
      period: '2024.01.15 - 2024.04.30',
      members: [
        {
          name: '이Captain',
          role: '팀장',
          avatar: 'https://via.placeholder.com/32/A8C5E6/FFFFFF?text=이',
        },
        {
          name: '김TCP',
          role: '백엔드',
          avatar: 'https://via.placeholder.com/32/C5A8E6/FFFFFF?text=김',
        },
        {
          name: '박Frontend',
          role: '프론트엔드',
          avatar: 'https://via.placeholder.com/32/A8E6C5/FFFFFF?text=박',
        },
        {
          name: '최Designer',
          role: '디자인',
          avatar: 'https://via.placeholder.com/32/E6A8C5/FFFFFF?text=최',
        },
      ],
      status: 'completed',
      achievement: '우수 프로젝트 선정',
      techStack: ['Spring Boot', 'React', 'AWS'],
      description:
        '실제 사용자들이 사용할 수 있는 웹 서비스를 개발하여 Software Maestro 과정을 수료했습니다.',
      goals: ['실서비스 개발', '사용자 피드백 수집', '비즈니스 모델 검증'],
      links: [
        'https://github.com/software-maestro-team',
        'https://project-demo.com',
      ],
    },
    {
      id: 'team4',
      title: 'ICPC 대회 팀',
      event: 'ACM-ICPC 대회',
      role: '팀원',
      period: '2023.09.01 - 2023.11.10',
      members: [
        {
          name: '알고리즘마스터',
          role: '팀장',
          avatar: 'https://via.placeholder.com/32/A8C5E6/FFFFFF?text=알',
        },
        {
          name: '김TCP',
          role: '팀원',
          avatar: 'https://via.placeholder.com/32/C5A8E6/FFFFFF?text=김',
        },
        {
          name: '코딩천재',
          role: '팀원',
          avatar: 'https://via.placeholder.com/32/A8E6C5/FFFFFF?text=코',
        },
      ],
      status: 'completed',
      achievement: '지역 예선 통과',
      techStack: ['C++', 'Algorithm', 'Data Structure'],
      description:
        'ACM-ICPC 프로그래밍 대회에 참가하여 알고리즘 문제 해결 능력을 겨뤘습니다.',
      goals: ['알고리즘 실력 향상', '팀워크 향상', '대회 입상'],
      links: ['https://github.com/icpc-team'],
    },
    {
      id: 'team5',
      title: '게임 개발 팀',
      event: '인디 게임 개발',
      role: '게임 프로그래머',
      period: '2023.03.01 - 2023.06.30',
      members: [
        {
          name: '게임기획자',
          role: '팀장',
          avatar: 'https://via.placeholder.com/32/A8C5E6/FFFFFF?text=게',
        },
        {
          name: '김TCP',
          role: '프로그래머',
          avatar: 'https://via.placeholder.com/32/C5A8E6/FFFFFF?text=김',
        },
        {
          name: '아티스트',
          role: '아트',
          avatar: 'https://via.placeholder.com/32/A8E6C5/FFFFFF?text=아',
        },
        {
          name: '사운드마스터',
          role: '사운드',
          avatar: 'https://via.placeholder.com/32/E6A8C5/FFFFFF?text=사',
        },
        {
          name: '테스터',
          role: 'QA',
          avatar: 'https://via.placeholder.com/32/A8C5E6/FFFFFF?text=테',
        },
      ],
      status: 'completed',
      achievement: 'Steam 출시 완료',
      techStack: ['Unity', 'C#', '2D Graphics'],
      description:
        '2D 플랫폼 게임을 개발하여 Steam에 출시한 인디 게임 개발 팀입니다.',
      goals: ['게임 개발', '플레이 테스트', 'Steam 출시'],
      links: [
        'https://github.com/game-dev-team',
        'https://store.steampowered.com/app/game',
      ],
    },
  ]);

  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

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
