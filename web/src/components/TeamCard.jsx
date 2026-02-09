import React from 'react';
import { Link } from 'react-router-dom';
import { tagColorClass, isExpired } from '../utils/helpers';

const TeamCard = React.memo(({ team, currentUser, applicationStatus, onOpenDetail, onEdit, onDelete, onStatusChange, isMyPage = false }) => {
  const expired = isExpired(team.deadline);
  // 마이페이지의 "내가 모집중인 팀"은 항상 내가 리더
  // 타입 불일치를 방지하기 위해 String으로 변환하여 비교
  const isLeader = team.teamCategory === 'recruiting' || team.teamCategory === 'completed' || (currentUser?.id && team.leaderId && String(currentUser.id) === String(team.leaderId));
  // 마이페이지에서는 본인 팀이면 항상 활성화, 그 외에는 모집중이고 마감 안된 것만 활성화
  const disabled = isMyPage && isLeader ? false : (team.status !== '모집중' || expired);
  const hasApplied = applicationStatus?.hasApplied || false;

  return (
    <div
      key={team.id}
      className={`recruitment-card rounded-xl overflow-hidden transition-transform duration-300 hover:-translate-y-1 ${disabled && !isMyPage ? 'brightness-75' : ''} ${disabled && !isLeader && !isMyPage ? 'opacity-60 cursor-not-allowed' : ''}`}
      onClick={() => (isMyPage || !disabled) && onOpenDetail(team)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((isMyPage || !disabled) && (e.key === 'Enter' || e.key === ' ')) onOpenDetail(team);
      }}
    >
      <img
        src={team.images?.[0]}
        alt={team.title}
        className="w-full h-40 object-cover"
      />
      <div className="p-6">
        <span
          className={`text-xs font-semibold mb-2 block ${team.status === '모집완료' ? 'text-gray-500' : 'text-accent-blue'} text-left`}
        >
          {team.category} 팀원 모집
        </span>
        <h3
          className={`orbitron text-xl font-bold mb-3 ${team.status === '모집완료' ? 'text-gray-500' : ''} text-left`}
        >
          {team.title}
        </h3>

        <div
          className={`text-sm space-y-2 mb-4 ${team.status === '모집완료' ? 'text-gray-500' : 'text-gray-400'} text-left`}
        >
          <p>
            <i className="fas fa-users mr-2 w-4 text-center" />
            <strong
              className={`${team.status === '모집완료' ? 'text-gray-400' : 'text-gray-300'}`}
            >
              필요 역할:
            </strong>{' '}
            {team.neededRoles}
          </p>
          <p>
            <i className="fas fa-calendar-alt mr-2 w-4 text-center" />
            <strong
              className={`${team.status === '모집완료' ? 'text-gray-400' : 'text-gray-300'}`}
            >
              일정:
            </strong>{' '}
            {team.period}
          </p>
          <p>
            <i className="fas fa-info-circle mr-2 w-4 text-center" />
            {team.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {team.tags?.map((tg, idx) => (
            <span
              key={`${team.id}-tg-${idx}`}
              className={`px-2 py-1 rounded-full text-xs ${tagColorClass(tg)}`}
            >
              {tg}
            </span>
          ))}
        </div>

        <div className="flex justify-between items-center text-left">
          <span
            className={`text-xs ${team.status === '모집완료' ? 'text-gray-500' : expired ? 'text-red-500' : 'text-red-400'}`}
          >
            {team.status === '모집완료'
              ? '모집 완료'
              : expired
                ? '마감됨'
                : `마감: ${team.deadline}`}
          </span>

          {isLeader && team.teamCategory === 'completed' ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(team);
                  }}
                  className="text-gray-400 hover:text-blue-400 transition-colors p-1.5"
                  title="수정하기"
                >
                  <i className="fas fa-pencil-alt"></i>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(team);
                  }}
                  className="transition-colors p-1.5 text-gray-500 hover:text-gray-400"
                  title="모집 재개하기"
                >
                  <i className="fas fa-toggle-off"></i>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(team.id);
                  }}
                  className="text-gray-400 hover:text-red-400 transition-colors p-1.5"
                  title="삭제하기"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
              <button
                className="bg-gray-700 text-gray-500 cursor-not-allowed px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                disabled
              >
                마감
              </button>
            </div>
          ) : isLeader ? (
            <div className="flex items-center gap-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(team);
                }}
                disabled={!isMyPage && disabled}
                className={`${!isMyPage && disabled ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-blue-400'} transition-colors p-1.5`}
                title={!isMyPage && disabled ? "마감된 모집글은 수정할 수 없습니다" : "수정하기"}
              >
                <i className="fas fa-pencil-alt"></i>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(team);
                }}
                className={`transition-colors p-1.5 ${team.status === '모집중' ? 'text-green-400 hover:text-green-300' : 'text-gray-500 hover:text-gray-400'}`}
                title={team.status === '모집중' ? '모집 마감하기' : '모집 재개하기'}
              >
                <i className={`fas ${team.status === '모집중' ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(team.id);
                }}
                className="text-gray-400 hover:text-red-400 transition-colors p-1.5"
                title="삭제하기"
              >
                <i className="fas fa-trash-alt"></i>
              </button>
              {!isMyPage && (
                <Link
                  to="/mypage/teams"
                  className="ml-2 bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-600 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  지원현황 보기
                </Link>
              )}
            </div>
          ) : (
            <button
              className={`${(disabled && !isMyPage) || team.teamCategory === 'completed' ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : hasApplied ? 'bg-green-600 text-white hover:bg-green-700' : 'cta-button text-white'} px-4 py-2 rounded-lg text-sm font-bold transition-colors`}
              disabled={(disabled && !isMyPage) || team.teamCategory === 'completed'}
              onClick={(e) => {
                e.stopPropagation();
                if (isMyPage || !disabled) onOpenDetail(team);
              }}
            >
              {team.teamCategory === 'completed' || (disabled && !isMyPage) ? '마감' : hasApplied ? '지원완료' : '지원하기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default TeamCard;
