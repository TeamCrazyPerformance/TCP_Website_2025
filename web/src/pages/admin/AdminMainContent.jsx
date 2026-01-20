import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave,
  faImages,
  faTrophy,
  faBookOpen,
  faUsers,
  faCamera,
  faUpload,
  faTrash,
  faUndo,
  faDownload,
} from '@fortawesome/free-solid-svg-icons';
import { stats as initialStats } from '../../data/stats';

function AdminMainContent() {
  // 통계 상태 관리
  const [stats, setStats] = useState({
    activeMembers: initialStats.totalMembers,
    completedProjects: initialStats.projects,
    competitionAwards: initialStats.awards,
    employmentRate: initialStats.employmentRate,
  });

  // 사진 프리뷰 상태 관리
  const [photos, setPhotos] = useState({
    competition: null,
    study: null,
    mt: null,
  });

  // 파일 입력 참조
  const fileInputRefs = {
    competition: useRef(null),
    study: useRef(null),
    mt: useRef(null),
  };

  // 통계 입력 변경 핸들러
  const handleStatChange = (e) => {
    const { id, value } = e.target;
    setStats((prevStats) => ({ ...prevStats, [id]: value }));
  };

  // 사진 선택 (파일 입력 클릭)
  const handleSelectPhoto = (type) => {
    fileInputRefs[type].current.click();
  };

  // 사진 프리뷰
  const handlePreviewPhoto = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotos((prevPhotos) => ({ ...prevPhotos, [type]: e.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // 사진 제거
  const handleRemovePhoto = (type) => {
    setPhotos((prevPhotos) => ({ ...prevPhotos, [type]: null }));
    fileInputRefs[type].current.value = '';
  };

  // 모든 통계 저장
  const saveStatistics = () => {
    // 중요: 이 기능은 데모용입니다.
    // create-react-app으로 만들어진 프론트엔드 애플리케이션은
    // 브라우저에서 서버의 파일을 직접 수정할 수 없습니다.
    // 실제 운영 환경에서는 이 함수 내에서 서버 API를 호출하여
    // 데이터베이스나 파일 시스템에 데이터를 저장해야 합니다.
    const content = `export const stats = {
  foundingYear: ${initialStats.foundingYear},
  totalMembers: ${stats.activeMembers},
  studyGroups: ${initialStats.studyGroups}, // 이 값은 현재 관리자 페이지에서 수정되지 않습니다.
  awards: ${stats.competitionAwards},
  projects: ${stats.completedProjects},
  employmentRate: ${stats.employmentRate},
};`;

    console.log('--- src/data/stats.js 파일에 저장될 내용 ---');
    console.log(content);
    alert(
      '통계 저장 버튼이 클릭되었습니다. 콘솔에서 저장될 내용을 확인하세요. 실제 파일 저장은 백엔드 기능이 필요합니다.'
    );
  };

  // 모든 사진 저장
  const saveAllPhotos = () => {
    console.log('Saving all photos:', photos);
    alert('모든 사진이 성공적으로 저장되었습니다!');
    // 실제로는 여기에 API 호출 로직이 들어갑니다.
  };

  // 모든 사진 초기화
  const resetAllPhotos = () => {
    if (
      window.confirm(
        '모든 사진을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.'
      )
    ) {
      setPhotos({ competition: null, study: null, mt: null });
      fileInputRefs.competition.current.value = '';
      fileInputRefs.study.current.value = '';
      fileInputRefs.mt.current.value = '';
      alert('모든 사진이 초기화되었습니다.');
    }
  };

  // 설정 내보내기/가져오기 (데모용)
  const exportSettings = () => {
    const settings = {
      statistics: stats,
      photos: photos,
      timestamp: new Date().toISOString(),
    };
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(settings, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'tcp_main_page_settings.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    alert('설정이 내보내기되었습니다.');
  };

  const importSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedSettings = JSON.parse(e.target.result);
            if (importedSettings.statistics)
              setStats(importedSettings.statistics);
            if (importedSettings.photos) setPhotos(importedSettings.photos);
            alert('설정이 성공적으로 가져와졌습니다.');
          } catch (error) {
            alert('설정 파일을 읽는 중 오류가 발생했습니다.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="container mx-auto max-w-7xl">
      {/* TCP Statistics Management */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h3 className="orbitron text-3xl font-bold gradient-text">
            TCP 통계 관리
          </h3>
          <button className="btn-primary" onClick={saveStatistics}>
            <FontAwesomeIcon icon={faSave} className="mr-2" />
            통계 저장
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Statistics Form */}
          <div className="widget-card p-6 rounded-xl">
            <h4 className="orbitron text-xl font-bold mb-6 text-blue-300">
              통계 수정
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="activeMembers" className="form-label">
                  활동 회원 수
                </label>
                <input
                  type="number"
                  className="form-input"
                  id="activeMembers"
                  value={stats.activeMembers}
                  onChange={handleStatChange}
                  min="0"
                />
              </div>
              <div>
                <label htmlFor="completedProjects" className="form-label">
                  완료된 프로젝트
                </label>
                <input
                  type="number"
                  className="form-input"
                  id="completedProjects"
                  value={stats.completedProjects}
                  onChange={handleStatChange}
                  min="0"
                />
              </div>
              <div>
                <label htmlFor="competitionAwards" className="form-label">
                  대회 수상 횟수
                </label>
                <input
                  type="number"
                  className="form-input"
                  id="competitionAwards"
                  value={stats.competitionAwards}
                  onChange={handleStatChange}
                  min="0"
                />
              </div>
              <div>
                <label htmlFor="employmentRate" className="form-label">
                  취업 성공률 (%)
                </label>
                <input
                  type="number"
                  className="form-input"
                  id="employmentRate"
                  value={stats.employmentRate}
                  onChange={handleStatChange}
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>

          {/* Statistics Preview */}
          <div className="widget-card p-6 rounded-xl">
            <h4 className="orbitron text-xl font-bold mb-6 text-purple-300">
              미리보기
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="stats-preview">
                <div className="text-3xl font-bold gradient-text mb-2">
                  {stats.activeMembers}+
                </div>
                <div className="text-sm text-gray-400">활동 회원</div>
              </div>
              <div className="stats-preview">
                <div className="text-3xl font-bold gradient-text mb-2">
                  {stats.completedProjects}+
                </div>
                <div className="text-sm text-gray-400">프로젝트 완료</div>
              </div>
              <div className="stats-preview">
                <div className="text-3xl font-bold gradient-text mb-2">
                  {stats.competitionAwards}+
                </div>
                <div className="text-sm text-gray-400">대회 수상</div>
              </div>
              <div className="stats-preview">
                <div className="text-3xl font-bold gradient-text mb-2">
                  {stats.employmentRate}%
                </div>
                <div className="text-sm text-gray-400">취업 성공률</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Activities Photo Management */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="orbitron text-3xl font-bold gradient-text">
            주요 활동 사진 관리
          </h3>
          <button className="btn-primary" onClick={saveAllPhotos}>
            <FontAwesomeIcon icon={faImages} className="mr-2" />
            모든 사진 저장
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Competition Participation */}
          <div className="widget-card p-6 rounded-xl">
            <h4 className="orbitron text-xl font-bold mb-4 text-yellow-300 flex items-center">
              <FontAwesomeIcon icon={faTrophy} className="mr-2" />
              대회 참가
            </h4>

            <div className="photo-preview mb-4">
              {!photos.competition && (
                <div className="text-center" id="competitionPlaceholder">
                  <FontAwesomeIcon
                    icon={faTrophy}
                    className="text-4xl text-yellow-400 mb-4"
                  />
                  <p className="text-yellow-300 font-bold">대회 참가</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Competition Participation
                  </p>
                </div>
              )}
              {photos.competition && (
                <img src={photos.competition} alt="Competition" />
              )}
              <div className="photo-overlay">
                <button
                  className="btn-secondary"
                  onClick={() => handleSelectPhoto('competition')}
                >
                  <FontAwesomeIcon icon={faCamera} className="mr-2" />
                  사진 변경
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="file"
                id="competitionFile"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handlePreviewPhoto(e, 'competition')}
                ref={fileInputRefs.competition}
              />
              <button
                className="btn-secondary w-full"
                onClick={() => handleSelectPhoto('competition')}
              >
                <FontAwesomeIcon icon={faUpload} className="mr-2" />
                사진 업로드
              </button>
              <button
                className="btn-secondary w-full"
                onClick={() => handleRemovePhoto('competition')}
              >
                <FontAwesomeIcon icon={faTrash} className="mr-2" />
                사진 제거
              </button>
            </div>

            <div className="mt-4 p-4 bg-yellow-900 bg-opacity-30 rounded-lg">
              <h5 className="font-semibold text-yellow-300 mb-2">추천 태그</h5>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-yellow-900 text-yellow-300 rounded-full text-xs">
                  ICPC
                </span>
                <span className="px-2 py-1 bg-yellow-900 text-yellow-300 rounded-full text-xs">
                  해커톤
                </span>
                <span className="px-2 py-1 bg-yellow-900 text-yellow-300 rounded-full text-xs">
                  창업경진대회
                </span>
              </div>
            </div>
          </div>

          {/* Study Sessions */}
          <div className="widget-card p-6 rounded-xl">
            <h4 className="orbitron text-xl font-bold mb-4 text-blue-300 flex items-center">
              <FontAwesomeIcon icon={faBookOpen} className="mr-2" />
              스터디 세션
            </h4>

            <div className="photo-preview mb-4">
              {!photos.study && (
                <div className="text-center" id="studyPlaceholder">
                  <FontAwesomeIcon
                    icon={faBookOpen}
                    className="text-4xl text-blue-400 mb-4"
                  />
                  <p className="text-blue-300 font-bold">스터디 세션</p>
                  <p className="text-sm text-gray-400 mt-2">Study Sessions</p>
                </div>
              )}
              {photos.study && <img src={photos.study} alt="Study" />}
              <div className="photo-overlay">
                <button
                  className="btn-secondary"
                  onClick={() => handleSelectPhoto('study')}
                >
                  <FontAwesomeIcon icon={faCamera} className="mr-2" />
                  사진 변경
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="file"
                id="studyFile"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handlePreviewPhoto(e, 'study')}
                ref={fileInputRefs.study}
              />
              <button
                className="btn-secondary w-full"
                onClick={() => handleSelectPhoto('study')}
              >
                <FontAwesomeIcon icon={faUpload} className="mr-2" />
                사진 업로드
              </button>
              <button
                className="btn-secondary w-full"
                onClick={() => handleRemovePhoto('study')}
              >
                <FontAwesomeIcon icon={faTrash} className="mr-2" />
                사진 제거
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-900 bg-opacity-30 rounded-lg">
              <h5 className="font-semibold text-blue-300 mb-2">추천 태그</h5>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded-full text-xs">
                  알고리즘
                </span>
                <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded-full text-xs">
                  웹개발
                </span>
                <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded-full text-xs">
                  AI/ML
                </span>
              </div>
            </div>
          </div>

          {/* MT Events */}
          <div className="widget-card p-6 rounded-xl">
            <h4 className="orbitron text-xl font-bold mb-4 text-green-300 flex items-center">
              <FontAwesomeIcon icon={faUsers} className="mr-2" />
              멤버십 트레이닝
            </h4>

            <div className="photo-preview mb-4">
              {!photos.mt && (
                <div className="text-center" id="mtPlaceholder">
                  <FontAwesomeIcon
                    icon={faUsers}
                    className="text-4xl text-green-400 mb-4"
                  />
                  <p className="text-green-300 font-bold">멤버십 트레이닝</p>
                  <p className="text-sm text-gray-400 mt-2">MT Events</p>
                </div>
              )}
              {photos.mt && <img src={photos.mt} alt="MT" />}
              <div className="photo-overlay">
                <button
                  className="btn-secondary"
                  onClick={() => handleSelectPhoto('mt')}
                >
                  <FontAwesomeIcon icon={faCamera} className="mr-2" />
                  사진 변경
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="file"
                id="mtFile"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handlePreviewPhoto(e, 'mt')}
                ref={fileInputRefs.mt}
              />
              <button
                className="btn-secondary w-full"
                onClick={() => handleSelectPhoto('mt')}
              >
                <FontAwesomeIcon icon={faUpload} className="mr-2" />
                사진 업로드
              </button>
              <button
                className="btn-secondary w-full"
                onClick={() => handleRemovePhoto('mt')}
              >
                <FontAwesomeIcon icon={faTrash} className="mr-2" />
                사진 제거
              </button>
            </div>

            <div className="mt-4 p-4 bg-green-900 bg-opacity-30 rounded-lg">
              <h5 className="font-semibold text-green-300 mb-2">추천 태그</h5>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-green-900 text-green-300 rounded-full text-xs">
                  팀빌딩
                </span>
                <span className="px-2 py-1 bg-green-900 text-green-300 rounded-full text-xs">
                  네트워킹
                </span>
                <span className="px-2 py-1 bg-green-900 text-green-300 rounded-full text-xs">
                  코딩캠프
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="mt-8 widget-card p-6 rounded-xl">
          <h4 className="orbitron text-xl font-bold mb-4 text-purple-300">
            일괄 작업
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button className="btn-secondary" onClick={resetAllPhotos}>
              <FontAwesomeIcon icon={faUndo} className="mr-2" />
              모든 사진 초기화
            </button>
            <button className="btn-secondary" onClick={exportSettings}>
              <FontAwesomeIcon icon={faDownload} className="mr-2" />
              설정 내보내기
            </button>
            <button className="btn-secondary" onClick={importSettings}>
              <FontAwesomeIcon icon={faUpload} className="mr-2" />
              설정 가져오기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminMainContent;
