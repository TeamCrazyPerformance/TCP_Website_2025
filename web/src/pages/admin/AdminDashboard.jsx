import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrochip,
  faMemory,
  faThermometerHalf,
  faHdd,
  faNetworkWired,
  faClock,
  faCalendarAlt,
  faUsers,
  faArrowUp,
  faArrowDown,
} from '@fortawesome/free-solid-svg-icons';

function AdminDashboard() {
  // 가짜(mock) 통계 데이터 상태
  const [stats] = useState({
    members: 185,
    studies: 35,
    server: {
      cpu: 42,
      ram: 6.8, // GB 단위
      ramTotal: 16,
      temp: 58, // °C
      disk: 75, // %
      networkTx: 15.2, // Mbps
      networkRx: 88.4, // Mbps
      uptime: '42d 11h 5m',
    },
  });

  const [serverTime, setServerTime] = useState('');

  // 실시간 서버 시간 업데이트
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setServerTime(now.toLocaleTimeString('ko-KR'));
    };
    updateTime();
    const intervalId = setInterval(updateTime, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const getProgressBarColor = (percentage) => {
    if (percentage > 80) return 'bg-red-500';
    if (percentage > 60) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="container mx-auto">
      {/* TCP Statistics Section */}
      <section className="mb-8">
        <h3 className="orbitron text-2xl font-bold gradient-text mb-4">
          TCP Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="widget-card p-6 rounded-xl">
            <h4 className="font-bold text-lg mb-4 text-blue-300">총 회원 수</h4>
            <div className="text-4xl font-black gradient-text mb-4">
              {stats.members}
            </div>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex justify-between">
                <span>재학생</span>
                <span className="font-semibold text-white">52</span>
              </li>
              <li className="flex justify-between">
                <span>휴학생</span>
                <span className="font-semibold text-white">5</span>
              </li>
              <li className="flex justify-between">
                <span>졸업생</span>
                <span className="font-semibold text-white">120</span>
              </li>
              <li className="flex justify-between">
                <span>탈퇴</span>
                <span className="font-semibold text-white">4</span>
              </li>
              <li className="flex justify-between">
                <span>재적</span>
                <span className="font-semibold text-white">3</span>
              </li>
              <li className="flex justify-between">
                <span>기타</span>
                <span className="font-semibold text-white">1</span>
              </li>
            </ul>
          </div>
          <div className="widget-card p-6 rounded-xl">
            <h4 className="font-bold text-lg mb-4 text-purple-300">
              총 스터디 수
            </h4>
            <div className="text-4xl font-black gradient-text mb-4">
              {stats.studies}
            </div>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex justify-between">
                <span>진행중</span>
                <span className="font-semibold text-white">10</span>
              </li>
              <li className="flex justify-between">
                <span>완료</span>
                <span className="font-semibold text-white">22</span>
              </li>
              <li className="flex justify-between">
                <span>취소</span>
                <span className="font-semibold text-white">3</span>
              </li>
              <li className="flex justify-between">
                <span>기타</span>
                <span className="font-semibold text-white">0</span>
              </li>
            </ul>
          </div>
          {/* Add more statistics cards here */}
        </div>
      </section>

      {/* Server Status Panel Section */}
      <section>
        <h3 className="orbitron text-2xl font-bold gradient-text mb-4">
          Server Status Panel
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div className="widget-card p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faMicrochip} className="text-blue-400" />
                <h5 className="font-semibold text-gray-300">CPU Usage</h5>
              </div>
              <span className="text-lg font-bold text-white">
                {stats.server.cpu}%
              </span>
            </div>
            <div className="progress-bar h-2">
              <div
                className={`progress-bar-inner ${getProgressBarColor(stats.server.cpu)}`}
                style={{ width: `${stats.server.cpu}%` }}
              ></div>
            </div>
          </div>
          <div className="widget-card p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faMemory} className="text-purple-400" />
                <h5 className="font-semibold text-gray-300">RAM Usage</h5>
              </div>
              <span className="text-lg font-bold text-white">
                {stats.server.ram} / {stats.server.ramTotal} GB
              </span>
            </div>
            <div className="progress-bar h-2">
              <div
                className={`progress-bar-inner ${getProgressBarColor((stats.server.ram / stats.server.ramTotal) * 100)}`}
                style={{
                  width: `${(stats.server.ram / stats.server.ramTotal) * 100}%`,
                }}
              ></div>
            </div>
          </div>
          <div className="widget-card p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon
                icon={faThermometerHalf}
                className="text-red-400"
              />
              <h5 className="font-semibold text-gray-300">CPU Temp</h5>
            </div>
            <span className="text-lg font-bold text-white">
              {stats.server.temp}°C
            </span>
          </div>
          <div className="widget-card p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faHdd} className="text-green-400" />
                <h5 className="font-semibold text-gray-300">Disk Usage</h5>
              </div>
              <span className="text-lg font-bold text-white">
                {stats.server.disk}%
              </span>
            </div>
            <div className="progress-bar h-2">
              <div
                className={`progress-bar-inner ${getProgressBarColor(stats.server.disk)}`}
                style={{ width: `${stats.server.disk}%` }}
              ></div>
            </div>
          </div>
          <div className="widget-card p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon
                icon={faNetworkWired}
                className="text-yellow-400"
              />
              <h5 className="font-semibold text-gray-300">Network</h5>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">
                <FontAwesomeIcon icon={faArrowUp} /> TX:{' '}
                {stats.server.networkTx} Mbps
              </div>
              <div className="text-sm font-bold text-white">
                <FontAwesomeIcon icon={faArrowDown} /> RX:{' '}
                {stats.server.networkRx} Mbps
              </div>
            </div>
          </div>
          <div className="widget-card p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon icon={faClock} className="text-pink-400" />
              <h5 className="font-semibold text-gray-300">Server Uptime</h5>
            </div>
            <span className="text-sm font-bold text-white">
              {stats.server.uptime}
            </span>
          </div>
          <div className="widget-card p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon icon={faCalendarAlt} className="text-cyan-400" />
              <h5 className="font-semibold text-gray-300">Server Time</h5>
            </div>
            <span id="server-time" className="text-sm font-bold text-white">
              {serverTime}
            </span>
          </div>
          <div className="widget-card p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon icon={faUsers} className="text-indigo-400" />
              <h5 className="font-semibold text-gray-300">Current Users</h5>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">Logged-in: 4</div>
              <div className="text-sm font-bold text-white">Guests: 12</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;
