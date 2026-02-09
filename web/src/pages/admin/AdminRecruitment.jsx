import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatBirthDate } from '../../utils/dateFormatter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave,
  faCheckCircle,
  faTimesCircle,
  faEye,
  faEyeSlash,
  faCalendarCheck,
  faCalendarPlus,
  faCalendarTimes,
  faInfoCircle,
  faPlay,
  faStop,
  faUndo,
  faList,
  faSpinner,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

function AdminRecruitment() {
  const navigate = useNavigate();
  const today = new Date();

  // State for data and loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Settings State
  const [settings, setSettings] = useState({
    applyButtonEnabled: false,
    recruitmentPeriod: {
      start: '',
      end: '',
    },
    autoDisable: false,
    autoEnable: false,
  });

  // Applications State
  const [applications, setApplications] = useState([]);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [settingsRes, appsRes] = await Promise.all([
        fetch('/api/v1/admin/recruitment/settings', { headers }),
        fetch('/api/v1/recruitment', { headers })
      ]);

      if (!settingsRes.ok || !appsRes.ok) {
        throw new Error('Failed to fetch recruitment data');
      }

      const settingsData = await settingsRes.json();
      const appsData = await appsRes.json();

      // Map backend settings to frontend state
      setSettings({
        applyButtonEnabled: settingsData.is_application_enabled,
        recruitmentPeriod: {
          start: settingsData.start_date ? settingsData.start_date.split('T')[0] : '',
          end: settingsData.end_date ? settingsData.end_date.split('T')[0] : '',
        },
        autoDisable: settingsData.auto_disable_on_end,
        autoEnable: settingsData.auto_enable_on_start,
      });

      // Map applications data
      const mappedApps = Array.isArray(appsData) ? appsData.map(app => ({
        time: new Date(app.created_at).toLocaleString('ko-KR'),
        name: app.name,
        major: app.major,
        status: app.review_status === 'pending' ? '접수완료' : app.review_status // Show actual status if available
      })) : [];

      setApplications(mappedApps);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // API helper
  const callApi = async (url, method, body = null) => {
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: body ? JSON.stringify(body) : null
      });
      if (!res.ok) throw new Error('API call failed');
      return await res.json();
    } catch (err) {
      console.error(err);
      alert('작업에 실패했습니다: ' + err.message);
      throw err;
    }
  };

  // Helper for auto-saving settings
  const updateBackendSetting = async (payload) => {
    try {
      await callApi('/api/v1/admin/recruitment/settings', 'PATCH', payload);
      // Success (quietly)
    } catch (e) {
      // Error alert is handled in callApi, but we might want to reload data to ensure sync
      fetchData();
    }
  };

  // Derived state from settings
  const startDate = settings.recruitmentPeriod.start ? new Date(settings.recruitmentPeriod.start) : null;
  const endDate = settings.recruitmentPeriod.end ? new Date(settings.recruitmentPeriod.end) : null;

  const isInPeriod = startDate && endDate ? today >= startDate && today <= endDate : false;
  const isUpcoming = startDate ? today < startDate : false;
  const isExpired = endDate ? today > endDate : false;

  // Stats calculation
  const totalApplicants = applications.length;
  const getWeeklyApplicants = () => {
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return applications.filter(app => new Date(app.time) >= oneWeekAgo).length;
  };
  const getDailyApplicants = () => {
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    return applications.filter(app => new Date(app.time) >= yesterday).length;
  };
  const weeklyApplicants = getWeeklyApplicants();
  const dailyApplicants = getDailyApplicants();

  // Handlers with auto-save
  const updateRecruitmentPeriod = (e) => {
    const { id, value } = e.target;
    // value is already formatted by formatBirthDate in onChange
    const key = id === 'startDate' ? 'start' : 'end';

    // Optimistic Update
    setSettings((prev) => ({
      ...prev,
      recruitmentPeriod: {
        ...prev.recruitmentPeriod,
        [key]: value,
      },
    }));

    // Auto Save only if valid date format (length 10)
    if (value.length === 10) {
      const backendField = id === 'startDate' ? 'start_date' : 'end_date';
      updateBackendSetting({ [backendField]: value });
    }
  };

  const toggleApplyButton = () => {
    const newValue = !settings.applyButtonEnabled;
    setSettings((prev) => ({ ...prev, applyButtonEnabled: newValue }));
    updateBackendSetting({ is_application_enabled: newValue });
  };

  const toggleAutoDisable = () => {
    const newValue = !settings.autoDisable;
    setSettings((prev) => ({ ...prev, autoDisable: newValue }));
    updateBackendSetting({ auto_disable_on_end: newValue });
  };

  const toggleAutoEnable = () => {
    const newValue = !settings.autoEnable;
    setSettings((prev) => ({ ...prev, autoEnable: newValue }));
    updateBackendSetting({ auto_enable_on_start: newValue });
  };

  const enableRecruitment = async () => {
    if (window.confirm('모집을 즉시 시작하시겠습니까?\n(오늘부터 3주간 모집 기간이 설정됩니다)')) {
      try {
        const result = await callApi('/api/v1/admin/recruitment/start-now', 'POST');
        const startDate = result.start_date ? result.start_date.split('T')[0] : '';
        const endDate = result.end_date ? result.end_date.split('T')[0] : '';
        setSettings(prev => ({
          ...prev,
          applyButtonEnabled: true,
          recruitmentPeriod: { start: startDate, end: endDate }
        }));
        alert('모집이 시작되었습니다!\n기간: ' + startDate + ' ~ ' + endDate);
      } catch (e) { /* handled in callApi */ }
    }
  };

  const disableRecruitment = async () => {
    if (window.confirm('모집을 즉시 중단하시겠습니까?\n(종료일이 오늘로 변경됩니다)')) {
      try {
        const result = await callApi('/api/v1/admin/recruitment/stop-now', 'POST');
        const endDate = result.end_date ? result.end_date.split('T')[0] : '';
        setSettings(prev => ({
          ...prev,
          applyButtonEnabled: false,
          recruitmentPeriod: { ...prev.recruitmentPeriod, end: endDate }
        }));
        alert('모집이 중단되었습니다.\n종료일: ' + endDate);
      } catch (e) { /* handled in callApi */ }
    }
  };

  const resetToDefaults = async () => {
    if (window.confirm('모든 설정을 기본값으로 초기화하시겠습니까? (즉시 적용됩니다)')) {
      const defaultSettings = {
        start_date: null,
        end_date: null,
        is_application_enabled: false,
        auto_enable_on_start: false,
        auto_disable_on_end: false
      };
      try {
        await callApi('/api/v1/admin/recruitment/settings', 'PATCH', defaultSettings);

        setSettings({
          applyButtonEnabled: false,
          recruitmentPeriod: { start: '', end: '' },
          autoDisable: false,
          autoEnable: false
        });
        alert('모든 설정이 기본값으로 초기화되었습니다.');
      } catch (e) { /* handled */ }
    }
  };

  // Period stats helper
  const calculatePeriod = (start, end) => {
    if (!start || !end) return { totalDays: 0, remainingDays: 0 };
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    const totalDays = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((endDateObj - today) / (1000 * 60 * 60 * 24));
    return { totalDays, remainingDays };
  };

  const periodCalc = calculatePeriod(settings.recruitmentPeriod.start, settings.recruitmentPeriod.end);

  const getPeriodStatus = () => {
    if (!settings.recruitmentPeriod.start || !settings.recruitmentPeriod.end)
      return { text: '기간 미설정', icon: faInfoCircle, className: '' };

    if (isUpcoming) return { text: '모집 시작 예정', icon: faCalendarPlus, className: 'upcoming' };
    if (isInPeriod) return { text: '모집 기간 중', icon: faCalendarCheck, className: 'active' };
    if (isExpired) return { text: '모집 종료', icon: faCalendarTimes, className: 'expired' };
    return { text: '상태 정보 없음', icon: faInfoCircle, className: '' };
  };

  const periodStatus = getPeriodStatus();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-96 text-red-400">
        <FontAwesomeIcon icon={faExclamationTriangle} className="text-4xl mb-4" />
        <p className="text-xl font-bold">오류가 발생했습니다: {error}</p>
        <button
          className="mt-4 px-4 py-2 bg-red-900 bg-opacity-50 hover:bg-opacity-70 rounded-lg transition-colors"
          onClick={fetchData}
        >
          재시도
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl">
      {/* Current Status Overview */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="orbitron text-3xl font-bold gradient-text">
            현재 모집 상태 (실시간 반영)
          </h3>
          <div className="flex items-center space-x-4">
            <div
              className={`status-badge ${settings.applyButtonEnabled
                ? 'status-active'
                : 'status-inactive'
                }`}
            >
              <FontAwesomeIcon
                icon={
                  settings.applyButtonEnabled
                    ? faCheckCircle
                    : faTimesCircle
                }
                className="mr-2"
              />
              {settings.applyButtonEnabled ? '모집 활성화' : '모집 비활성화'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Stats */}
          <div className="widget-card p-6 rounded-xl">
            <h4 className="orbitron text-xl font-bold mb-4 text-blue-300">
              지원 현황
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">총 지원자</span>
                <span className="text-2xl font-bold gradient-text">
                  {totalApplicants || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">이번 주</span>
                <span className="text-xl font-bold text-green-400">
                  {weeklyApplicants || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">최근 24시간</span>
                <span className="text-lg font-bold text-blue-400">
                  {dailyApplicants || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Recruitment Period */}
          <div className="widget-card p-6 rounded-xl">
            <h4 className="orbitron text-xl font-bold mb-4 text-purple-300">
              모집 기간
            </h4>
            <div className="space-y-4">
              <div>
                <span className="text-gray-300 text-sm">시작일</span>
                <div className="text-lg font-bold text-white">
                  {settings.recruitmentPeriod.start || '-'}
                </div>
              </div>
              <div>
                <span className="text-gray-300 text-sm">종료일</span>
                <div className="text-lg font-bold text-white">
                  {settings.recruitmentPeriod.end || '-'}
                </div>
              </div>
              <div
                className={`date-status ${periodStatus.className}`}
                id="periodStatus"
              >
                <FontAwesomeIcon icon={periodStatus.icon} className="mr-2" />
                {periodStatus.text}
              </div>
            </div>
          </div>

          {/* Button Status */}
          <div className="widget-card p-6 rounded-xl">
            <h4 className="orbitron text-xl font-bold mb-4 text-green-300">
              지원 버튼 상태
            </h4>
            <div className="text-center">
              <div className="mb-4">
                <span className="text-gray-300 text-sm">현재 상태</span>
              </div>
              <div
                id="buttonStatusDisplay"
                className={`status-badge ${settings.applyButtonEnabled
                  ? 'status-active'
                  : 'status-inactive'
                  } mb-4`}
              >
                <FontAwesomeIcon
                  icon={settings.applyButtonEnabled ? faEye : faEyeSlash}
                  className="mr-2"
                />
                {settings.applyButtonEnabled ? '활성화됨' : '비활성화됨'}
              </div>
              <div className="text-sm text-gray-400">
                {settings.applyButtonEnabled
                  ? '지원자들이 "지금 지원하기" 버튼을 클릭할 수 있습니다'
                  : '버튼이 비활성화되어 지원이 불가능해집니다'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Settings Control Panel */}
      <section className="mb-8">
        <h3 className="orbitron text-3xl font-bold gradient-text mb-6">
          설정 제어판
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Application Button Control */}
          <div className="widget-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-6">
              <h4 className="orbitron text-xl font-bold text-blue-300">
                지원 버튼 제어
              </h4>
              <div
                className={`toggle-switch ${settings.applyButtonEnabled ? 'active' : ''
                  }`}
                onClick={toggleApplyButton}
                id="applyButtonToggle"
              ></div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-900 bg-opacity-30 rounded-lg">
                <h5 className="font-semibold text-blue-300 mb-2">기능 설명</h5>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>
                    <FontAwesomeIcon icon={faInfoCircle} className="mr-2" />
                    토글을 켜면 모집 페이지의 "지금 지원하기" 버튼이
                    활성화됩니다
                  </li>
                  <li>
                    <FontAwesomeIcon icon={faInfoCircle} className="mr-2" />
                    토글을 끄면 버튼이 비활성화되어 지원이 불가능해집니다
                  </li>
                  <li>
                    <FontAwesomeIcon icon={faInfoCircle} className="mr-2" />
                    모집 기간과 별도로 독립적으로 제어 가능합니다
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon
                    icon={faInfoCircle}
                    className="text-blue-400"
                  />
                  <span className="text-sm text-gray-300">현재 설정</span>
                </div>
                <div className="pl-6">
                  <span className="text-sm" id="buttonToggleStatus">
                    {settings.applyButtonEnabled
                      ? '지원 버튼이 활성화되어 있습니다'
                      : '지원 버튼이 비활성화되어 있습니다'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recruitment Period Control */}
          <div className="widget-card p-6 rounded-xl">
            <h4 className="orbitron text-xl font-bold mb-6 text-purple-300">
              모집 기간 설정
            </h4>

            <div className="space-y-4">
              <div>
                <label htmlFor="startDate" className="form-label">
                  모집 시작일
                </label>
                <input
                  type="text"
                  className="form-input"
                  id="startDate"
                  value={settings.recruitmentPeriod.start}
                  onChange={(e) => {
                    const val = formatBirthDate(e.target.value);
                    // Call original handler with modified value
                    updateRecruitmentPeriod({ target: { id: 'startDate', value: val } });
                  }}
                  placeholder="YYYY.MM.DD"
                  maxLength={10}
                />
              </div>

              <div>
                <label htmlFor="endDate" className="form-label">
                  모집 종료일
                </label>
                <input
                  type="text"
                  className="form-input"
                  id="endDate"
                  value={settings.recruitmentPeriod.end}
                  onChange={(e) => {
                    const val = formatBirthDate(e.target.value);
                    // Call original handler with modified value
                    updateRecruitmentPeriod({ target: { id: 'endDate', value: val } });
                  }}
                  placeholder="YYYY.MM.DD"
                  maxLength={10}
                />
              </div>

              <div className="p-4 bg-purple-900 bg-opacity-30 rounded-lg">
                <h5 className="font-semibold text-purple-300 mb-2">
                  기간 정보
                </h5>
                <div className="text-sm text-gray-300 space-y-1">
                  <div>
                    총 모집 기간:{' '}
                    <span id="totalDays" className="font-semibold text-white">
                      {periodCalc.totalDays}일
                    </span>
                  </div>
                  <div>
                    남은 기간:{' '}
                    <span
                      id="remainingDays"
                      className={`font-semibold ${isUpcoming
                        ? 'text-blue-400'
                        : isInPeriod
                          ? 'text-green-400'
                          : 'text-red-400'
                        }`}
                    >
                      {periodCalc.remainingDays > 0
                        ? (isUpcoming
                          ? `${periodCalc.remainingDays}일 후 시작`
                          : `${periodCalc.remainingDays}일`)
                        : `${Math.abs(periodCalc.remainingDays)}일 전 종료`
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Preview Section */}
      <section className="mb-8">
        <h3 className="orbitron text-3xl font-bold gradient-text mb-6">
          실시간 미리보기
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Button Preview */}
          <div className="widget-card p-6 rounded-xl">
            <h4 className="orbitron text-xl font-bold mb-6 text-green-300">
              지원 버튼 미리보기
            </h4>
            <div className="preview-card">
              <div className="mb-4">
                <h5 className="orbitron text-lg font-bold mb-2 text-gray-300">
                  모집 페이지에서 보이는 모습
                </h5>
              </div>
              <div
                className={`preview-button-${settings.applyButtonEnabled ? 'active' : 'inactive'
                  } orbitron`}
              >
                <FontAwesomeIcon icon={settings.applyButtonEnabled ? faPlay : faStop} className="mr-2" />
                {settings.applyButtonEnabled ? '지금 지원하기' : '모집 기간이 아닙니다'}
              </div>
              <div
                className="mt-4 text-sm text-gray-400"
                id="buttonPreviewStatus"
              >
                {settings.applyButtonEnabled
                  ? '버튼이 활성화되어 있어 사용자가 클릭하여 지원서를 작성할 수 있습니다'
                  : '버튼이 비활성화되어 있어 사용자가 지원할 수 없습니다'}
              </div>
            </div>
          </div>

          {/* Period Display Preview */}
          <div className="widget-card p-6 rounded-xl">
            <h4 className="orbitron text-xl font-bold mb-6 text-yellow-300">
              기간 표시 미리보기
            </h4>
            <div className="preview-card">
              <div className="mb-4">
                <h5 className="orbitron text-lg font-bold mb-2 text-gray-300">
                  사용자에게 표시되는 정보
                </h5>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">지원 기간</div>
                <div className="text-lg font-bold text-white mb-1">
                  {settings.recruitmentPeriod.start ? new Date(
                    settings.recruitmentPeriod.start
                  ).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }) : '미설정'}
                  {' ~ '}
                  {settings.recruitmentPeriod.end ? new Date(
                    settings.recruitmentPeriod.end
                  ).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  }) : '미설정'}
                </div>
                <div className={`date-status ${periodStatus.className}`}>
                  <FontAwesomeIcon icon={periodStatus.icon} className="mr-2" />
                  {periodStatus.text}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Settings */}
      <section className="mb-8">
        <h3 className="orbitron text-3xl font-bold gradient-text mb-6">
          고급 설정
        </h3>

        <div className="widget-card p-6 rounded-xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Automatic Controls */}
            <div>
              <h4 className="orbitron text-xl font-bold mb-4 text-pink-300">
                자동 제어
              </h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-pink-900 bg-opacity-20 rounded-lg">
                  <div>
                    <div className="font-semibold text-pink-300">
                      기간 만료 시 자동 비활성화
                    </div>
                    <div className="text-sm text-gray-400">
                      모집 종료일이 지나면 자동으로 지원 버튼을 비활성화합니다
                    </div>
                  </div>
                  <div
                    className={`toggle-switch ${settings.autoDisable ? 'active' : ''
                      }`}
                    onClick={toggleAutoDisable}
                    id="autoDisableToggle"
                  ></div>
                </div>

                <div className="flex items-center justify-between p-4 bg-pink-900 bg-opacity-20 rounded-lg">
                  <div>
                    <div className="font-semibold text-pink-300">
                      시작일 자동 활성화
                    </div>
                    <div className="text-sm text-gray-400">
                      모집 시작일이 되면 자동으로 지원 버튼을 활성화합니다
                    </div>
                  </div>
                  <div
                    className={`toggle-switch ${settings.autoEnable ? 'active' : ''
                      }`}
                    onClick={toggleAutoEnable}
                    id="autoEnableToggle"
                  ></div>
                </div>
              </div>
            </div>

            {/* Bulk Actions */}
            <div>
              <h4 className="orbitron text-xl font-bold mb-4 text-cyan-300">
                일괄 작업
              </h4>
              <div className="space-y-3">
                <button
                  className="btn-success w-full"
                  onClick={enableRecruitment}
                >
                  <FontAwesomeIcon icon={faPlay} className="mr-2" />
                  새 모집 시작 (3주간)
                </button>

                <button
                  className="btn-danger w-full"
                  onClick={disableRecruitment}
                >
                  <FontAwesomeIcon icon={faStop} className="mr-2" />
                  모집 마감
                </button>

                <button
                  className="btn-secondary w-full"
                  onClick={resetToDefaults}
                >
                  <FontAwesomeIcon icon={faUndo} className="mr-2" />
                  기본값으로 초기화
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Application Log */}
      <section>
        <h3 className="orbitron text-3xl font-bold gradient-text mb-6">
          최근 지원 현황
        </h3>

        <div className="widget-card p-6 rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-3 font-semibold text-gray-300">
                    시간
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-300">
                    지원자
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-300">
                    학과
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-300">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody id="applicationLog">
                {applications.length > 0 ? (
                  applications.slice(0, 10).map((app, index) => (
                    <tr key={index} className="border-b border-gray-800">
                      <td className="p-3 text-gray-400">{app.time}</td>
                      <td className="p-3 text-white">{app.name}</td>
                      <td className="p-3 text-gray-300">{app.major}</td>
                      <td className="p-3">
                        <span className="status-badge status-active">
                          {app.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center p-4 text-gray-500">
                      아직 접수된 지원서가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-center">
            <button
              className="btn-secondary"
              onClick={() => navigate('/admin/application')}
            >
              <FontAwesomeIcon icon={faList} className="mr-2" />
              모든 지원서 보기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminRecruitment;
