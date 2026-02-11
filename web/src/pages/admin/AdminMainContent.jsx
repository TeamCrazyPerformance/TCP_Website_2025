import React, { useState, useRef, useEffect } from 'react';
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
  faTimes,
  faPlus,
  faExclamationTriangle,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';



function AdminMainContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);



  // 통계 상태 관리
  const [stats, setStats] = useState({
    activeMembers: 0,
    completedProjects: 0,
    competitionAwards: 0,
    employmentRate: 0,
  });

  // 사진 프리뷰 상태 관리 (URL or base64)
  const [photos, setPhotos] = useState({
    competition: null,
    study: null,
    mt: null,
  });

  // 태그 상태 관리
  const [tags, setTags] = useState({
    competition: [],
    study: [],
    mt: [],
  });

  // 파일 객체 관리 (업로드용)
  const [files, setFiles] = useState({
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
  const importFileRef = useRef(null);

  // 초기 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('access_token');
        const [imgRes, statRes] = await Promise.all([
          fetch('/api/v1/admin/activity-images', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/v1/admin/statistics', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!imgRes.ok && !statRes.ok) {
          throw new Error('Failed to fetch data');
        }

        if (imgRes.ok) {
          const data = await imgRes.json();
          setPhotos({
            competition: data.competition, // URL from backend
            study: data.study,
            mt: data.mt,
          });
          if (data.tags) {
            setTags(data.tags);
          }
        }

        if (statRes.ok) {
          const statData = await statRes.json();
          setStats({
            activeMembers: statData.totalMembers,
            completedProjects: statData.projects,
            competitionAwards: statData.awards,
            employmentRate: statData.employmentRate,
          });
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setError('데이터를 불러오는데 실패했습니다: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 통계 입력 변경 핸들러
  const handleStatChange = (e) => {
    const { id, value } = e.target;
    setStats((prevStats) => ({ ...prevStats, [id]: value }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-64 text-red-400">
        <FontAwesomeIcon icon={faExclamationTriangle} className="text-4xl mb-4" />
        <p className="text-xl font-bold">{error}</p>
        <button
          className="mt-4 px-4 py-2 bg-red-900 bg-opacity-50 hover:bg-opacity-70 rounded-lg transition-colors"
          onClick={() => window.location.reload()}
        >
          재시도
        </button>
      </div>
    );
  }

  // 태그 추가
  const handleAddTag = (type, tag) => {
    if (tag && !tags[type].includes(tag)) {
      setTags(prev => ({
        ...prev,
        [type]: [...prev[type], tag]
      }));
    }
  };

  // 태그 삭제
  const handleRemoveTag = (type, tagToRemove) => {
    setTags(prev => ({
      ...prev,
      [type]: prev[type].filter(tag => tag !== tagToRemove)
    }));
  };

  // 사진 선택 (파일 입력 클릭)
  const handleSelectPhoto = (type) => {
    fileInputRefs[type].current.click();
  };

  // 사진 프리뷰 및 파일 저장
  const handlePreviewPhoto = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotos((prevPhotos) => ({ ...prevPhotos, [type]: ev.target.result }));
        setFiles(prev => ({ ...prev, [type]: file }));
      };
      reader.readAsDataURL(file);
    }
  };



  // 사진 제거
  const handleRemovePhoto = (type) => {
    setPhotos((prevPhotos) => ({ ...prevPhotos, [type]: null }));
    setFiles(prev => ({ ...prev, [type]: null }));
    fileInputRefs[type].current.value = '';
  };

  // 통계 저장 (별도)
  const saveStatistics = async () => {
    const token = localStorage.getItem('access_token');
    const statsData = {
      totalMembers: parseInt(stats.activeMembers),
      awards: parseInt(stats.competitionAwards),
      projects: parseInt(stats.completedProjects),
      employmentRate: parseFloat(stats.employmentRate),
    };

    try {
      const response = await fetch('/api/v1/admin/statistics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(statsData),
      });

      if (!response.ok) throw new Error('Failed to save statistics');

      alert('통계가 성공적으로 저장되었습니다!');
    } catch (error) {
      console.error('Error saving statistics:', error);
      alert('통계 저장 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 모든 사진 및 태그 저장
  const saveAllPhotos = async () => {
    const token = localStorage.getItem('access_token');

    // 1. 이미지 및 삭제 요청 전송
    const formData = new FormData();
    if (files.competition) formData.append('competition', files.competition);
    if (files.study) formData.append('study', files.study);
    if (files.mt) formData.append('mt', files.mt);
    if (!photos.competition) formData.append('removeCompetition', 'true');
    if (!photos.study) formData.append('removeStudy', 'true');
    if (!photos.mt) formData.append('removeMt', 'true');

    try {
      // 이미지 저장 요청
      const imgRes = await fetch('/api/v1/admin/activity-images', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!imgRes.ok) throw new Error('Failed to save images');

      // 2. 태그 저장 요청
      const tagRes = await fetch('/api/v1/admin/activity-images/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(tags),
      });

      if (!tagRes.ok) throw new Error('Failed to save tags');

      alert('모든 사진과 태그가 성공적으로 저장되었습니다!');
    } catch (error) {
      console.error('Error saving:', error);
      alert('저장 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 모든 사진 초기화
  const resetAllPhotos = async () => {
    if (!window.confirm('정말 모든 사진과 태그를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/admin/activity-images/reset', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert('모든 사진과 태그가 초기화되었습니다.');
        setPhotos({ competition: null, study: null, mt: null });
        setTags({ competition: [], study: [], mt: [] });
        setFiles({ competition: null, study: null, mt: null });
      } else {
        alert('초기화 실패');
      }
    } catch (e) {
      console.error(e);
      alert('오류 발생');
    }
  };

  // 설정 내보내기
  const exportSettings = async () => {
    try {
      const token = localStorage.getItem('access_token');
      // Stats
      const statsRes = await fetch('/api/v1/admin/statistics/export', { headers: { Authorization: `Bearer ${token}` } });
      const statsBlob = await statsRes.blob();
      const statsUrl = window.URL.createObjectURL(statsBlob);
      const a1 = document.createElement('a');
      a1.href = statsUrl;
      a1.download = 'statistic.json';
      a1.click();

      // Photos
      const tagsRes = await fetch('/api/v1/admin/activity-images/tags/export', { headers: { Authorization: `Bearer ${token}` } });
      const tagsBlob = await tagsRes.blob();
      const tagsUrl = window.URL.createObjectURL(tagsBlob);
      const a2 = document.createElement('a');
      a2.href = tagsUrl;
      a2.download = 'photos.json';
      a2.click();
    } catch (e) {
      console.error(e);
      alert('내보내기 실패');
    }
  };

  // 설정 가져오기 (파일 선택 트리거)
  const importSettings = () => {
    alert('statistic.json과 photos.json 파일 2개를 선택해주세요.');
    importFileRef.current.click();
  };

  // 설정 가져오기 (실제 처리)
  const handleImportFileChange = async (e) => {
    if (e.target.files.length !== 2) {
      alert('반드시 2개의 파일(statistic.json, photos.json)을 선택해야 합니다.');
      e.target.value = ''; // Reset
      return;
    }

    const formData = new FormData();
    let statsFound = false;
    let tagsFound = false;

    Array.from(e.target.files).forEach(file => {
      if (file.name === 'statistic.json') {
        formData.append('statistics', file);
        statsFound = true;
      } else if (file.name === 'photos.json') {
        formData.append('tags', file);
        tagsFound = true;
      }
    });

    if (!statsFound || !tagsFound) {
      alert('파일명이 정확해야 합니다: statistic.json, photos.json');
      e.target.value = ''; // Reset
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/admin/system/settings/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        alert('설정을 성공적으로 불러왔습니다.');
        window.location.reload();
      } else {
        const err = await res.json();
        alert(err.message || '불러오기 실패');
      }
    } catch (e) {
      console.error(e);
      alert('오류 발생');
    }
    e.target.value = ''; // Reset
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
            모두 저장
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
                <img
                  src={photos.competition}
                  alt="Competition"
                  onError={(e) => { e.target.style.display = 'none'; document.getElementById('competitionPlaceholder').style.display = 'block'; }}
                />
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

            {/* Competition Tags */}
            <div className="mt-4 p-4 bg-yellow-900 bg-opacity-30 rounded-lg">
              <h5 className="font-semibold text-yellow-300 mb-2">태그 관리 (Enter로 추가, 클릭하여 삭제)</h5>
              <div className="flex flex-wrap gap-2 items-center">
                {tags.competition.map((tag, index) => (
                  <span
                    key={index}
                    onClick={() => handleRemoveTag('competition', tag)}
                    className="px-2 py-1 bg-yellow-900 text-yellow-300 rounded-full text-xs cursor-pointer hover:bg-yellow-800 transition-colors"
                    title="클릭하여 삭제"
                  >
                    {tag} <FontAwesomeIcon icon={faTimes} className="ml-1" />
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="+ 태그 추가"
                  className="px-2 py-1 bg-yellow-900 bg-opacity-50 text-yellow-300 rounded-full text-xs border border-yellow-700 focus:outline-none focus:border-yellow-500 w-24"
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag('competition', e.target.value.trim());
                      e.target.value = '';
                    }
                  }}
                />
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
              {photos.study && (
                <img
                  src={photos.study}
                  alt="Study"
                  onError={(e) => { e.target.style.display = 'none'; document.getElementById('studyPlaceholder').style.display = 'block'; }}
                />
              )}
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

            {/* Study Tags */}
            <div className="mt-4 p-4 bg-blue-900 bg-opacity-30 rounded-lg">
              <h5 className="font-semibold text-blue-300 mb-2">태그 관리</h5>
              <div className="flex flex-wrap gap-2 items-center">
                {tags.study.map((tag, index) => (
                  <span
                    key={index}
                    onClick={() => handleRemoveTag('study', tag)}
                    className="px-2 py-1 bg-blue-900 text-blue-300 rounded-full text-xs cursor-pointer hover:bg-blue-800 transition-colors"
                  >
                    {tag} <FontAwesomeIcon icon={faTimes} className="ml-1" />
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="+ 태그 추가"
                  className="px-2 py-1 bg-blue-900 bg-opacity-50 text-blue-300 rounded-full text-xs border border-blue-700 focus:outline-none focus:border-blue-500 w-24"
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag('study', e.target.value.trim());
                      e.target.value = '';
                    }
                  }}
                />
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
              {photos.mt && (
                <img
                  src={photos.mt}
                  alt="MT"
                  onError={(e) => { e.target.style.display = 'none'; document.getElementById('mtPlaceholder').style.display = 'block'; }}
                />
              )}
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

            {/* MT Tags */}
            <div className="mt-4 p-4 bg-green-900 bg-opacity-30 rounded-lg">
              <h5 className="font-semibold text-green-300 mb-2">태그 관리</h5>
              <div className="flex flex-wrap gap-2 items-center">
                {tags.mt.map((tag, index) => (
                  <span
                    key={index}
                    onClick={() => handleRemoveTag('mt', tag)}
                    className="px-2 py-1 bg-green-900 text-green-300 rounded-full text-xs cursor-pointer hover:bg-green-800 transition-colors"
                  >
                    {tag} <FontAwesomeIcon icon={faTimes} className="ml-1" />
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="+ 태그 추가"
                  className="px-2 py-1 bg-green-900 bg-opacity-50 text-green-300 rounded-full text-xs border border-green-700 focus:outline-none focus:border-green-500 w-24"
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag('mt', e.target.value.trim());
                      e.target.value = '';
                    }
                  }}
                />
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

      {/* Hidden File Input for Import */}
      <input
        type="file"
        ref={importFileRef}
        style={{ display: 'none' }}
        accept=".json"
        multiple
        onChange={handleImportFileChange}
      />

    </div>
  );
}

export default AdminMainContent;
