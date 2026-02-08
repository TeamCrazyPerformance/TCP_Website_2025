import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import InfoRow from '../ui/InfoRow';
import { isExpired } from '../../utils/helpers';
import { apiGet, apiPost, apiDelete } from '../../api/client';

export default function TeamDetailModal({ isOpen, onClose, team, onApplicationStatusChange, isMyPage = false, isAdminView = false }) {
  const { user } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLeader = user?.id && team?.leaderId && user.id === team.leaderId;

  useEffect(() => {
    // Reset image index when team changes
    setCurrentImageIndex(0);
    setSelectedRoleId(null);
    setApplicationStatus(null);
  }, [team]);

  // 지원 상태 조회
  useEffect(() => {
    const fetchApplicationStatus = async () => {
      if (!user || !team?.id) return;
      
      setIsLoadingStatus(true);
      try {
        const data = await apiGet(`/api/v1/teams/${team.id}/application-status`);
        setApplicationStatus(data);
        if (data.hasApplied && data.applicationInfo?.appliedRole) {
          setSelectedRoleId(data.applicationInfo.appliedRole.id);
        }
      } catch (error) {
        // 401 에러는 무시 (비로그인 상태)
        if (error.response?.status !== 401) {
          console.error('Failed to fetch application status:', error);
        }
      } finally {
        setIsLoadingStatus(false);
      }
    };

    fetchApplicationStatus();
  }, [user, team?.id]);

  const changeImage = (dir) => {
    if (!team || (team.images?.length || 0) <= 1) return;
    setCurrentImageIndex((prev) => {
      const len = team.images.length;
      return (prev + dir + len) % len;
    });
  };

  // 지원하기 핸들러
  const handleApply = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!selectedRoleId) {
      alert('지원할 역할을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost(`/api/v1/teams/${team.id}/apply`, { roleId: selectedRoleId });
      
      // 상태 업데이트
      const roleInfo = team.rolesRaw?.find(r => r.id === selectedRoleId);
      const newStatus = {
        hasApplied: true,
        applicationInfo: {
          appliedRole: roleInfo ? {
            id: roleInfo.id,
            roleName: roleInfo.roleName,
          } : null,
        },
      };
      setApplicationStatus(newStatus);
      
      // 부모 컴포넌트에 상태 변경 알림
      if (onApplicationStatusChange) {
        onApplicationStatusChange(team.id, newStatus);
      }
      
      alert('지원이 완료되었습니다! 팀 리더가 연락드릴 예정입니다.');
    } catch (error) {
      alert(error.message || '지원에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 지원 취소 핸들러
  const handleCancelApplication = async () => {
    if (!window.confirm('정말 지원을 취소하시겠습니까?')) return;

    setIsSubmitting(true);
    try {
      await apiDelete(`/api/v1/teams/${team.id}/apply`);
      
      const newStatus = {
        hasApplied: false,
        applicationInfo: null,
      };
      setApplicationStatus(newStatus);
      setSelectedRoleId(null);
      
      // 부모 컴포넌트에 상태 변경 알림
      if (onApplicationStatusChange) {
        onApplicationStatusChange(team.id, newStatus);
      }
      
      alert('지원이 취소되었습니다.');
    } catch (error) {
      alert(error.message || '지원 취소에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !team) return null;

  return (
    <div
      className="modal active"
      onClick={(e) => {
        if (e.target.className.includes('modal')) onClose();
      }}
    >
      <div className="modal-content">
        <button className="close-modal" onClick={onClose}>
          <i className="fas fa-times" />
        </button>

        <div className="mb-6">
          <h3 className="orbitron text-2xl font-bold gradient-text">
            팀 상세 정보
          </h3>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2">

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
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${team.status === '모집중' ? 'status-badge-recruiting' : 'bg-gray-700 text-gray-300'}`}
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
              <div className="flex items-center p-3 bg-gray-800 bg-opacity-50 rounded-lg">
                <div className="relative">
                  <img
                    src={team.leader.avatar}
                    alt={team.leader.name}
                    className="w-12 h-12 rounded-full border-2 border-accent-blue"
                    onError={(e) => {
                      e.target.onerror = null; // 무한 루프 방지
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect width="48" height="48" fill="%23A8C5E6"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="20" fill="white"%3EL%3C/text%3E%3C/svg%3E';
                    }}
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
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4">
              <p className="text-gray-300 whitespace-pre-line">
                {team.fullDescription}
              </p>
            </div>
          </section>

          {/* Participants */}


          {/* Needed Roles */}
          <section className="mb-6">
            <h4 className="font-semibold text-white mb-3 flex items-center">
              <i className="fas fa-user-plus text-red-400 mr-2" />
              모집 중인 역할
            </h4>
            <div className="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-50 rounded-lg p-4">
              <div className="flex flex-col space-y-1">
                {team.neededRoles.split(',').map((role, idx) => (
                  <span key={idx} className="text-red-300">
                    {role.trim()}
                  </span>
                ))}
              </div>
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
          {/* Goals */}
          <section className="mb-6">
            <h4 className="font-semibold text-white mb-3 flex items-center">
              <i className="fas fa-target text-green-400 mr-2" />
              프로젝트 목표
            </h4>
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4">
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                {team.goals?.map((g, idx) => (
                  <li key={`goal-${idx}`}>{g}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* Selection Process */}
          <section className="mb-6">
            <h4 className="font-semibold text-white mb-3 flex items-center">
              <i className="fas fa-clipboard-check text-indigo-400 mr-2" />
              선발 과정
            </h4>
            <div className="bg-indigo-500 bg-opacity-10 border border-indigo-500 border-opacity-50 rounded-lg p-4">
              <p className="text-indigo-300">
                {team.selectionProcess}
              </p>
            </div>
          </section>

          {/* Tags */}
          <section className="mb-6">
            <h4 className="font-semibold text-white mb-3 flex items-center">
              <i className="fas fa-tags text-purple-400 mr-2" />
              태그
            </h4>
            <div className="flex flex-wrap gap-2">
              {team.tags?.map((tag, idx) => (
                <span
                  key={`tag-${idx}`}
                  className="px-2 py-1 bg-gray-800 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
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
            <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-50 rounded-lg p-4">
              <p className="text-green-300">{team.contact}</p>
            </div>
          </section>

          {/* 지원자 정보 - 리더인 경우에만 표시 */}
          {team.applicants && team.applicants.length > 0 && (
            <section className="mb-6">
              <h4 className="font-semibold text-white mb-3 flex items-center">
                <i className="fas fa-users text-yellow-400 mr-2" />
                지원 멤버 ({team.applicants.length}명)
              </h4>
              <div className="bg-gray-800 bg-opacity-50 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-700 bg-opacity-50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-300">이름</th>
                      <th className="px-4 py-3 font-semibold text-gray-300">지원역할</th>
                      <th className="px-4 py-3 font-semibold text-gray-300">전화</th>
                      <th className="px-4 py-3 font-semibold text-gray-300">이메일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {team.applicants.map((applicant) => (
                      <tr key={applicant.id} className="hover:bg-gray-700 hover:bg-opacity-30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{applicant.name}</td>
                        <td className="px-4 py-3 text-gray-300">{applicant.role?.roleName || applicant.role?.name || '역할 미정'}</td>
                        <td className="px-4 py-3">
                          <a 
                            href={`tel:${applicant.phoneNumber}`}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {applicant.phoneNumber}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <a 
                            href={`mailto:${applicant.email}`}
                            className="text-blue-400 hover:text-blue-300 transition-colors break-all"
                          >
                            {applicant.email}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 역할 선택 - 로그인 사용자 & 리더 아님 & 지원하지 않은 경우만 표시 */}
          {!isAdminView && user && !isLeader && !applicationStatus?.hasApplied && team.status === '모집중' && !isExpired(team.deadline) && (
            <section className="mb-6">
              <h4 className="font-semibold text-white mb-3 flex items-center">
                <i className="fas fa-user-tag text-purple-400 mr-2" />
                지원 역할 선택
              </h4>
              <select
                value={selectedRoleId || ''}
                onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent-blue transition-colors"
              >
                <option value="">역할을 선택하세요</option>
                {team.rolesRaw?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.roleName}
                  </option>
                ))}
              </select>
            </section>
          )}

          {/* 이미 지원한 경우 정보 표시 */}
          {!isAdminView && applicationStatus?.hasApplied && applicationStatus.applicationInfo?.appliedRole && (
            <section className="mb-6">
              <h4 className="font-semibold text-white mb-3 flex items-center">
                <i className="fas fa-check-circle text-green-400 mr-2" />
                지원 상태
              </h4>
              <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-50 rounded-lg p-4">
                <p className="text-green-300">
                  <i className="fas fa-check mr-2" />
                  <strong>{applicationStatus.applicationInfo.appliedRole.roleName}</strong> 역할로 지원하셨습니다.
                </p>
              </div>
            </section>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-600 rounded-lg hover:border-gray-400 transition-colors"
            >
              닫기
            </button>

            {/* 로그인하지 않은 경우 */}
            {!isAdminView && !user && team.status === '모집중' && !isExpired(team.deadline) && (
              <button
                onClick={() => {
                  alert('로그인이 필요합니다.');
                  onClose();
                }}
                className="cta-button px-6 py-2 rounded-lg font-medium text-white"
              >
                <i className="fas fa-paper-plane mr-2" />
                지원하기
              </button>
            )}

            {/* 로그인한 경우 */}
            {!isAdminView && user && team.status === '모집중' && !isExpired(team.deadline) && (
              <>
                {isLeader && !isMyPage ? (
                  <a
                    href="/mypage/teams"
                    className="bg-gray-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-600 transition-colors inline-flex items-center"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = '/mypage/teams';
                    }}
                  >
                    <i className="fas fa-users mr-2" />
                    지원현황 보기
                  </a>
                ) : isLeader && isMyPage ? null : applicationStatus?.hasApplied ? (
                  <button
                    onClick={handleCancelApplication}
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-times mr-2" />
                    {isSubmitting ? '처리 중...' : '지원 취소'}
                  </button>
                ) : (
                  <button
                    onClick={handleApply}
                    disabled={isSubmitting || isLoadingStatus}
                    className="cta-button px-6 py-2 rounded-lg font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-paper-plane mr-2" />
                    {isSubmitting ? '처리 중...' : '지원하기'}
                  </button>
                )}
              </>
            )}

            {/* 모집 마감 또는 기한 만료 */}
            {!isAdminView && (team.status !== '모집중' || isExpired(team.deadline)) && (
              <button
                disabled
                className="bg-gray-700 text-gray-500 cursor-not-allowed px-6 py-2 rounded-lg font-medium"
              >
                마감
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
