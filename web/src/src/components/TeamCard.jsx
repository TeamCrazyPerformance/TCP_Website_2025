import React from 'react';
import { tagColorClass, isExpired } from '../utils/helpers';

const TeamCard = React.memo(({ team, onOpenDetail }) => {
  const expired = isExpired(team.deadline);
  const disabled = team.status !== '모집중' || expired;

  return (
    <div
      key={team.id}
      className={`recruitment-card rounded-xl overflow-hidden transition-transform duration-300 hover:-translate-y-1 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      onClick={() => !disabled && onOpenDetail(team)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) onOpenDetail(team);
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
          <button
            className={`${disabled ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'cta-button text-white'} px-4 py-2 rounded-lg text-sm font-bold`}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) onOpenDetail(team);
            }}
          >
            {disabled ? '마감' : '지원하기'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default TeamCard;
