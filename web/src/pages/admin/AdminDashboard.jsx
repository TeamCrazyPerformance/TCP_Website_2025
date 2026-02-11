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
  faSpinner,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

function AdminDashboard() {
  const [dashboardStats, setDashboardStats] = useState(null);
  const [serverStats, setServerStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serverTime, setServerTime] = useState('');

  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [serverUptime, setServerUptime] = useState(0);

  // Fetch dashboard and server stats
  const fetchStats = async () => {
    const token = localStorage.getItem('access_token');
    try {
      const [dashboardRes, serverRes] = await Promise.all([
        fetch('/api/v1/admin/system/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/admin/system/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!dashboardRes.ok || !serverRes.ok) {
        throw new Error('Failed to fetch stats');
      }

      const dashboardData = await dashboardRes.json();
      const serverData = await serverRes.json();

      setDashboardStats(dashboardData);
      setServerStats(serverData);

      // Calculate time offset (Server Time - Client Time)
      if (serverData.serverTime) {
        const serverDate = new Date(serverData.serverTime);
        const clientDate = new Date();
        const offset = serverDate.getTime() - clientDate.getTime();
        setServerTimeOffset(offset);
      }

      // Initialize uptime
      if (serverData.uptime) {
        setServerUptime(serverData.uptime);
      }
      setError(null); // Clear error on success
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and 10-second refresh interval for stats
  useEffect(() => {
    fetchStats();
    const intervalId = setInterval(fetchStats, 10000); // Refresh stats every 10 seconds
    return () => clearInterval(intervalId);
  }, []);

  // 1-second timer for real-time clock
  useEffect(() => {
    const updateRealTime = () => {
      const now = new Date(new Date().getTime() + serverTimeOffset);
      setServerTime(now.toLocaleTimeString('ko-KR'));
      setServerUptime((prev) => prev + 1);
    };

    updateRealTime();
    const timerId = setInterval(updateRealTime, 1000);
    return () => clearInterval(timerId);
  }, [serverTimeOffset]);

  const getProgressBarColor = (percentage) => {
    if (percentage > 80) return 'bg-red-500';
    if (percentage > 60) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  // Helper function to format bytes to GB
  const bytesToGB = (bytes) => (bytes / (1024 * 1024 * 1024)).toFixed(1);

  // Helper function to format uptime seconds to readable string
  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-96 text-red-400">
        <FontAwesomeIcon icon={faExclamationTriangle} className="text-4xl mb-4" />
        <p className="text-xl font-bold">데이터를 불러오는데 실패했습니다: {error}</p>
        <button
          className="mt-4 px-4 py-2 bg-red-900 bg-opacity-50 hover:bg-opacity-70 rounded-lg transition-colors"
          onClick={() => window.location.reload()}
        >
          재시도
        </button>
      </div>
    );
  }

  // Prepare stats object for display
  const stats = {
    members: dashboardStats?.members?.total || 0,
    studies: dashboardStats?.studies?.total || 0,
    memberDetails: dashboardStats?.members || {},
    studyDetails: dashboardStats?.studies || {},
    server: serverStats ? {
      cpu: serverStats.cpu?.usagePercentage || 0,
      ram: parseFloat(bytesToGB(serverStats.memory?.active || 0)),
      ramTotal: parseFloat(bytesToGB(serverStats.memory?.total || 1)),
      temp: serverStats.cpu?.temperature || null, // May be null in Docker containers
      disk: serverStats.disk?.usagePercentage || 0,
      networkTx: serverStats.network?.txPerSecond || 0, // MB/s
      networkRx: serverStats.network?.rxPerSecond || 0, // MB/s
      uptime: formatUptime(serverUptime),
    } : {},
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
                <span className="font-semibold text-white">{stats.memberDetails.enrolled || 0}</span>
              </li>
              <li className="flex justify-between">
                <span>휴학생</span>
                <span className="font-semibold text-white">{stats.memberDetails.onLeave || 0}</span>
              </li>
              <li className="flex justify-between">
                <span>졸업생</span>
                <span className="font-semibold text-white">{stats.memberDetails.graduated || 0}</span>
              </li>
              <li className="flex justify-between">
                <span>기타</span>
                <span className="font-semibold text-white">{stats.memberDetails.other || 0}</span>
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
                <span className="font-semibold text-white">{stats.studyDetails.inProgress || 0}</span>
              </li>
              <li className="flex justify-between">
                <span>완료</span>
                <span className="font-semibold text-white">{stats.studyDetails.completed || 0}</span>
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
              {stats.server.temp ? `${stats.server.temp}°C` : 'N/A'}
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
                {stats.server.networkTx} MB/s
              </div>
              <div className="text-sm font-bold text-white">
                <FontAwesomeIcon icon={faArrowDown} /> RX:{' '}
                {stats.server.networkRx} MB/s
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
            <span className="text-sm font-bold text-gray-500">N/A</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;
