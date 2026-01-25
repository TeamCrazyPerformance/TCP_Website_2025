import React, { useState } from 'react';
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
} from '@fortawesome/free-solid-svg-icons';

function AdminRecruitment() {
  const today = new Date();
  const defaultStartDate = '2025-08-01';
  const defaultEndDate = '2025-09-01';

  // 설정 상태 관리
  const [settings, setSettings] = useState({
    applyButtonEnabled: true,
    recruitmentPeriod: {
      start: defaultStartDate,
      end: defaultEndDate,
    },
    autoDisable: true,
    autoEnable: true,
  });

  // 지원 현황 더미 데이터
  const [applications] = useState([
    {
      time: '2025-01-15 14:30',
      name: '김개발',
      major: '컴퓨터공학과',
      status: '접수완료',
    },
    {
      time: '2025-01-15 11:20',
      name: '이프론트',
      major: '전자정보공학과',
      status: '접수완료',
    },
    {
      time: '2025-01-14 16:45',
      name: '박백엔드',
      major: '컴퓨터공학과',
      status: '접수완료',
    },
    {
      time: '2025-01-14 09:15',
      name: '최풀스택',
      major: '소프트웨어학과',
      status: '접수완료',
    },
    {
      time: '2025-01-13 18:20',
      name: '정데이터',
      major: '전자공학과',
      status: '접수완료',
    },
  ]);

  const startDate = new Date(settings.recruitmentPeriod.start);
  const endDate = new Date(settings.recruitmentPeriod.end);
  const isInPeriod = today >= startDate && today <= endDate;
  const isUpcoming = today < startDate;
  const isExpired = today > endDate;

  const totalApplicants = applications.length; // 총 지원자 수 (데모)
  const weeklyApplicants = 12; // 이번 주 지원자 수 (데모)
  const dailyApplicants = 3; // 어제 지원자 수 (데모)

  const updateRecruitmentPeriod = (e) => {
    const { id, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      recruitmentPeriod: {
        ...prev.recruitmentPeriod,
        [id === 'startDate' ? 'start' : 'end']: value,
      },
    }));
  };

  const toggleApplyButton = () => {
    setSettings((prev) => ({
      ...prev,
      applyButtonEnabled: !prev.applyButtonEnabled,
    }));
  };

  const toggleAutoDisable = () => {
    setSettings((prev) => ({ ...prev, autoDisable: !prev.autoDisable }));
  };

  const toggleAutoEnable = () => {
    setSettings((prev) => ({ ...prev, autoEnable: !prev.autoEnable }));
  };

  const enableRecruitment = () => {
    if (window.confirm('모집을 즉시 시작하시겠습니까?')) {
      setSettings((prev) => ({ ...prev, applyButtonEnabled: true }));
      alert('모집이 즉시 시작되었습니다!');
    }
  };

  const disableRecruitment = () => {
    if (window.confirm('모집을 즉시 중단하시겠습니까?')) {
      setSettings((prev) => ({ ...prev, applyButtonEnabled: false }));
      alert('모집이 즉시 중단되었습니다.');
    }
  };

  const resetToDefaults = () => {
    if (window.confirm('모든 설정을 기본값으로 초기화하시겠습니까?')) {
      setSettings({
        applyButtonEnabled: true,
        recruitmentPeriod: {
          start: defaultStartDate,
          end: defaultEndDate,
        },
        autoDisable: true,
        autoEnable: true,
      });
      alert('모든 설정이 기본값으로 초기화되었습니다.');
    }
  };

  const saveAllSettings = () => {
    console.log('Saving all settings:', settings);
    alert('모든 설정이 저장되었습니다!');
  };

  // 기간 관련 계산
  const calculatePeriod = (start, end) => {
    const totalDays = Math.ceil(
      (new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)
    );
    const remainingDays = Math.ceil(
      (new Date(end) - today) / (1000 * 60 * 60 * 24)
    );
    return { totalDays, remainingDays };
  };

  const periodCalc = calculatePeriod(
    settings.recruitmentPeriod.start,
    settings.recruitmentPeriod.end
  );

  const getPeriodStatus = () => {
    if (isUpcoming)
      return {
        text: '모집 시작 예정',
        icon: faCalendarPlus,
        className: 'upcoming',
      };
    if (isInPeriod)
      return {
        text: '모집 기간 중',
        icon: faCalendarCheck,
        className: 'active',
      };
    if (isExpired)
      return { text: '모집 종료', icon: faCalendarTimes, className: 'expired' };
    return { text: '상태 정보 없음', icon: faInfoCircle, className: '' };
  };

  const periodStatus = getPeriodStatus();

  return (
    <div className="container mx-auto max-w-7xl">
      {/* Current Status Overview */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="orbitron text-3xl font-bold gradient-text">
            현재 모집 상태
          </h3>
          <div className="flex items-center space-x-4">
            <div
              className={`status-badge ${
                settings.applyButtonEnabled && isInPeriod
                  ? 'status-active'
                  : 'status-inactive'
              }`}
              id="currentStatus"
            >
              <FontAwesomeIcon
                icon={
                  settings.applyButtonEnabled && isInPeriod
                    ? faCheckCircle
                    : faTimesCircle
                }
                className="mr-2"
              />
              {settings.applyButtonEnabled && isInPeriod
                ? '모집 활성화'
                : '모집 비활성화'}
            </div>
            <button className="btn-primary" onClick={saveAllSettings}>
              <FontAwesomeIcon icon={faSave} className="mr-2" />
              모든 설정 저장
            </button>
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
                  {totalApplicants}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">이번 주</span>
                <span className="text-xl font-bold text-green-400">
                  {weeklyApplicants}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">어제</span>
                <span className="text-lg font-bold text-blue-400">
                  {dailyApplicants}
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
                  {settings.recruitmentPeriod.start}
                </div>
              </div>
              <div>
                <span className="text-gray-300 text-sm">종료일</span>
                <div className="text-lg font-bold text-white">
                  {settings.recruitmentPeriod.end}
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
                className={`status-badge ${
                  settings.applyButtonEnabled
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
                className={`toggle-switch ${
                  settings.applyButtonEnabled ? 'active' : ''
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
                  type="date"
                  className="form-input"
                  id="startDate"
                  value={settings.recruitmentPeriod.start}
                  onChange={updateRecruitmentPeriod}
                />
              </div>

              <div>
                <label htmlFor="endDate" className="form-label">
                  모집 종료일
                </label>
                <input
                  type="date"
                  className="form-input"
                  id="endDate"
                  value={settings.recruitmentPeriod.end}
                  onChange={updateRecruitmentPeriod}
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
                      className={`font-semibold ${
                        isUpcoming
                          ? 'text-blue-400'
                          : isInPeriod
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {isUpcoming
                        ? `${periodCalc.remainingDays}일 후 시작`
                        : isInPeriod
                        ? `${periodCalc.remainingDays}일`
                        : `${Math.abs(
                            periodCalc.remainingDays
                          )}일 전 종료`}
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
                  recruitment.html 에서 보이는 모습
                </h5>
              </div>
              <div
                className={`preview-button-${
                  settings.applyButtonEnabled ? 'active' : 'inactive'
                } orbitron`}
              >
                <FontAwesomeIcon icon={faPlay} className="mr-2" />
                지금 지원하기
              </div>
              <div
                className="mt-4 text-sm text-gray-400"
                id="buttonPreviewStatus"
              >
                {settings.applyButtonEnabled
                  ? '버튼이 활성화되어 있어 사용자가 클릭할 수 있습니다'
                  : '버튼이 비활성화되어 있어 사용자가 클릭할 수 없습니다'}
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
                  {new Date(
                    settings.recruitmentPeriod.start
                  ).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}{' '}
                  ~{' '}
                  {new Date(settings.recruitmentPeriod.end).toLocaleDateString(
                    'ko-KR',
                    { year: 'numeric', month: 'long', day: 'numeric' }
                  )}
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
                    className={`toggle-switch ${
                      settings.autoDisable ? 'active' : ''
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
                    className={`toggle-switch ${
                      settings.autoEnable ? 'active' : ''
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
                  모집 즉시 시작
                </button>

                <button
                  className="btn-danger w-full"
                  onClick={disableRecruitment}
                >
                  <FontAwesomeIcon icon={faStop} className="mr-2" />
                  모집 즉시 중단
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
                {applications.map((app, index) => (
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
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-center">
            <button
              className="btn-secondary"
              onClick={() => alert('모든 지원서 보기 페이지로 이동')}
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