import React, { useState, useEffect } from 'react';
import InfoRow from '../ui/InfoRow';
import { isExpired } from '../../utils/helpers';

export default function TeamDetailModal({ isOpen, onClose, team }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    // Reset image index when team changes
    setCurrentImageIndex(0);
  }, [team]);

  const changeImage = (dir) => {
    if (!team || (team.images?.length || 0) <= 1) return;
    setCurrentImageIndex((prev) => {
      const len = team.images.length;
      return (prev + dir + len) % len;
    });
  };

  if (!isOpen || !team) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 rounded-2xl border border-gray-800 p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="orbitron text-2xl font-bold gradient-text">
            팀 상세 정보
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
            aria-label="모달 닫기"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Image Carousel */}
        {team.images?.length ? (
          <div className="relative mb-6">
            <img
              src={team.images[currentImageIndex]}
              alt={`${team.title} 이미지 ${currentImageIndex + 1}`}
              className="w-full h-64 object-cover rounded-lg"
            />
            {team.images.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-2"
                  onClick={() => changeImage(-1)}
                  aria-label="이전 이미지"
                >
                  <i className="fas fa-chevron-left" />
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-2"
                  onClick={() => changeImage(1)}
                  aria-label="다음 이미지"
                >
                  <i className="fas fa-chevron-right" />
                </button>
              </>
            )}
          </div>
        ) : null}

        {/* Project Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="font-semibold text-white mb-3 flex items-center">
              <i className="fas fa-info-circle text-blue-400 mr-2" />
              기본 정보
            </h4>
            <div className="space-y-3 text-sm text-gray-300">
              <InfoRow label="상태">
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${team.status === '모집중' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}`}
                >
                  {team.status}
                </span>
              </InfoRow>
              <InfoRow label="카테고리">{team.category}</InfoRow>
              <InfoRow label="진행 기간">{team.period}</InfoRow>
              <InfoRow label="지원 마감">
                <span
                  className={`${isExpired(team.deadline) ? 'text-red-400' : 'text-yellow-400'}`}
                >
                  {team.deadline}
                </span>
              </InfoRow>
              <InfoRow label="진행 방식">{team.location}</InfoRow>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3 flex items-center">
              <i className="fas fa-user-crown text-yellow-400 mr-2" />팀 리더
            </h4>
            <div className="flex items-center p-3 bg-gray-800/50 rounded-lg">
              <div className="relative">
                <img
                  src={team.leader.avatar}
                  alt={team.leader.name}
                  className="w-12 h-12 rounded-full border-2 border-accent-blue"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-500 text-black rounded-full grid place-items-center text-xs">
                  <i className="fas fa-crown" />
                </div>
              </div>
              <div className="ml-3">
                <div className="font-semibold text-white">
                  {team.leader.name}
                </div>
                <div className="text-sm text-gray-400">
                  {team.leader.role}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <section className="mb-6">
          <h4 className="font-semibold text-white mb-3 flex items-center">
            <i className="fas fa-file-alt text-green-400 mr-2" />
            프로젝트 상세 설명
          </h4>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-gray-300 whitespace-pre-line">
              {team.fullDescription}
            </p>
          </div>
        </section>

        {/* Participants */}
        <section className="mb-6">
          <h4 className="font-semibold text-white mb-3 flex items-center">
            <i className="fas fa-users text-purple-400 mr-2" />
            현재 팀원 ({team.participants?.length || 0}명)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {team.participants?.map((p, idx) => (
              <div
                key={`p-${idx}`}
                className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg"
              >
                <img
                  src={p.avatar}
                  alt={p.name}
                  className="w-10 h-10 rounded-full border-2 border-gray-600"
                />
                <div>
                  <div className="font-semibold text-white">{p.name}</div>
                  <div className="text-sm text-gray-400">{p.role}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Needed Roles */}
        <section className="mb-6">
          <h4 className="font-semibold text-white mb-3 flex items-center">
            <i className="fas fa-user-plus text-red-400 mr-2" />
            모집 중인 역할
          </h4>
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
            <p className="text-red-300">{team.neededRoles}</p>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-6">
          <h4 className="font-semibold text-white mb-3 flex items-center">
            <i className="fas fa-code text-blue-400 mr-2" />
            기술 스택
          </h4>
          <div className="flex flex-wrap gap-2">
            {team.techStack?.map((tech, idx) => (
              <span
                key={`tech-${idx}`}
                className="px-2 py-1 bg-gray-800 rounded text-xs"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        {/* Goals & Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <section>
            <h4 className="font-semibold text-white mb-3 flex items-center">
              <i className="fas fa-target text-green-400 mr-2" />
              프로젝트 목표
            </h4>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              {team.goals?.map((g, idx) => (
                <li key={`goal-${idx}`}>{g}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="font-semibold text-white mb-3 flex items-center">
              <i className="fas fa-gift text-yellow-400 mr-2" />
              참여 혜택
            </h4>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              {team.benefits?.map((b, idx) => (
                <li key={`benefit-${idx}`}>{b}</li>
              ))}
            </ul>
          </section>
        </div>

        {/* Selection Process */}
        <section className="mb-6">
          <h4 className="font-semibold text-white mb-3 flex items-center">
            <i className="fas fa-clipboard-check text-indigo-400 mr-2" />
            선발 과정
          </h4>
          <div className="bg-indigo-900/20 border border-indigo-800 rounded-lg p-4">
            <p className="text-indigo-300">
              {team.selectionProcess}
            </p>
          </div>
        </section>

        {/* Links */}
        {team.links?.length ? (
          <section className="mb-6">
            <h4 className="font-semibold text-white mb-3 flex items-center">
              <i className="fas fa-link text-pink-400 mr-2" />
              관련 링크
            </h4>
            <div className="flex flex-wrap gap-2">
              {team.links.map((lnk, idx) => (
                <a
                  key={`lnk-${idx}`}
                  href={lnk}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center px-3 py-2 bg-gray-800/50 rounded-lg text-blue-400 hover:text-blue-300 text-sm"
                >
                  <i className="fas fa-external-link-alt mr-2" />
                  {lnk}
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {/* Contact + Actions */}
        <section className="mb-6">
          <h4 className="font-semibold text-white mb-3 flex items-center">
            <i className="fas fa-envelope text-green-400 mr-2" />
            연락처
          </h4>
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
            <p className="text-green-300">{team.contact}</p>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-600 rounded-lg hover:border-gray-400 transition-colors"
          >
            닫기
          </button>
          {team.status === '모집중' &&
          !isExpired(team.deadline) ? (
            <button
              onClick={() => {
                alert(
                  '지원이 완료되었습니다! 팀 리더가 연락드릴 예정입니다.'
                );
                onClose();
              }}
              className="cta-button px-6 py-2 rounded-lg font-medium text-white"
            >
              <i className="fas fa-paper-plane mr-2" />
              지원하기
            </button>
          ) : (
            <button
              disabled
              className="bg-gray-700 text-gray-500 cursor-not-allowed px-6 py-2 rounded-lg font-medium"
            >
              지원 불가
            </button>
          )}
        </div>
      </div>
    </div>
  );
}