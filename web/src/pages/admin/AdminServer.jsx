import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// 바이트를 읽기 쉬운 형식으로 변환
const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 초를 읽기 쉬운 업타임 형식으로 변환
const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

const StatCard = ({ icon, title, value, details, progressBar }) => (
    <div className="widget-card p-6 rounded-xl">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2"><i className={`fas ${icon} text-blue-400`}></i><h5 className="font-semibold text-gray-300">{title}</h5></div>
            {value && <span className="text-lg font-bold text-white">{value}</span>}
        </div>
        {progressBar && <div className="progress-bar h-3 mb-2"><div className="progress-bar-inner" style={{ width: `${Math.min(progressBar.percent, 100)}%` }}></div></div>}
        {details && <div className="text-xs text-gray-400 space-y-1">{details.map(d => <div key={d.label}>{d.label}: {d.value}</div>)}</div>}
    </div>
);

const ServiceCard = ({ icon, name, type, status, details }) => (
    <div className="service-card">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3"><i className={`fas ${icon} text-2xl`}></i>
                <div><h5 className="font-bold text-white">{name}</h5><p className="text-sm text-gray-400">{type}</p></div>
            </div>
            <span className={`status-indicator status-${status.toLowerCase()}`}><i className="fas fa-circle mr-1"></i>{status}</span>
        </div>
        <div className="space-y-2">{details.map(d => <div key={d.label} className="flex justify-between text-sm"><span className="text-gray-400">{d.label}:</span><span className="text-white">{d.value}</span></div>)}</div>
    </div>
);

const ControlCard = ({ icon, title, description, buttonText, buttonIcon, onAction, statusText, colorClass, loading, disabled }) => (
    <div className="widget-card p-6 rounded-xl">
        <div className="flex items-center space-x-3 mb-4"><i className={`fas ${icon} ${colorClass} text-2xl`}></i>
            <div><h5 className="font-bold text-white">{title}</h5><p className="text-sm text-gray-400">{description}</p></div>
        </div>
        <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-gray-300">현재 상태:</span><span className="text-sm text-gray-400">{statusText}</span></div>
            <button className={`btn-warning w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={onAction} disabled={loading || disabled}>
                <i className={`fas ${loading ? 'fa-spinner fa-spin' : buttonIcon} mr-2`}></i>{loading ? '처리 중...' : buttonText}
            </button>
        </div>
    </div>
);

const AdminServer = () => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState({});
    const [cpuHistory, setCpuHistory] = useState([]);
    const [memHistory, setMemHistory] = useState([]);
    const chartRef = useRef(null);

    const fetchMetrics = useCallback(async () => {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
            }
            
            const statsRes = await fetch('/api/v1/admin/system/stats', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (statsRes.status === 401) {
                throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
            }
            if (!statsRes.ok) throw new Error('시스템 상태를 불러오는데 실패했습니다.');
            
            const stats = await statsRes.json();

            setMetrics(stats);
            
            // Update history for chart (keep last 20 points)
            setCpuHistory(prev => [...prev.slice(-19), stats.cpu.usagePercentage]);
            setMemHistory(prev => [...prev.slice(-19), stats.memory.usagePercentage]);
            
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 5000); // 5초마다 갱신
        return () => clearInterval(interval);
    }, [fetchMetrics]);

    const handleServerRestart = async () => {
        if (!window.confirm('정말 서버를 재시작하시겠습니까? 잠시 서비스가 중단됩니다.')) return;
        
        setActionLoading(prev => ({ ...prev, restart: true }));
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch('/api/v1/admin/system/restart', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to restart server');
            alert('서버가 재시작됩니다. 잠시 후 페이지를 새로고침하세요.');
        } catch (err) {
            alert('재시작 실패: ' + err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, restart: false }));
        }
    };

    const chartData = {
        labels: Array.from({ length: 20 }, (_, i) => i - 19).map(i => i === 0 ? '현재' : `${i}s`),
        datasets: [
            { 
                label: 'CPU 사용률 (%)', 
                data: [...Array(20 - cpuHistory.length).fill(null), ...cpuHistory],
                borderColor: '#a8c5e6', 
                backgroundColor: 'rgba(168, 197, 230, 0.1)',
                tension: 0.4,
                fill: true
            },
            { 
                label: '메모리 사용률 (%)', 
                data: [...Array(20 - memHistory.length).fill(null), ...memHistory],
                borderColor: '#c5a8e6', 
                backgroundColor: 'rgba(197, 168, 230, 0.1)',
                tension: 0.4,
                fill: true
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                grid: { color: 'rgba(255,255,255,0.1)' },
                ticks: { color: '#9ca3af' }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#9ca3af' }
            }
        },
        plugins: {
            legend: { labels: { color: '#9ca3af' } }
        }
    };

    if (loading && !metrics) return <div className="p-8 text-center text-white">서버 상태 로딩 중...</div>;
    if (error && !metrics) return <div className="p-8 text-center text-red-500">에러: {error}</div>;

    const cpu = metrics?.cpu || {};
    const memory = metrics?.memory || {};
    const disk = metrics?.disk || {};
    const network = metrics?.network || {};

    return (
        <div className="container mx-auto max-w-7xl p-6">
            <section className="mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-3xl font-bold gradient-text">서버 상태 모니터링</h3>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400">
                            {metrics?.serverTime ? `서버 시간: ${new Date(metrics.serverTime).toLocaleString('ko-KR')}` : ''}
                        </span>
                        <button onClick={fetchMetrics} className="btn-secondary text-sm">
                            <i className="fas fa-sync mr-2"></i>새로고침
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                        icon="fa-microchip" 
                        title="CPU 사용률" 
                        value={`${cpu.usagePercentage || 0}%`} 
                        progressBar={{ percent: cpu.usagePercentage || 0 }} 
                        details={[
                            {label: '코어', value: `${cpu.cores || '-'}개`},
                            {label: '온도', value: cpu.temperature ? `${cpu.temperature}°C` : 'N/A'}
                        ]}
                    />
                    <StatCard 
                        icon="fa-memory" 
                        title="메모리 사용률" 
                        value={`${formatBytes(memory.active || 0)} / ${formatBytes(memory.total || 0)}`} 
                        progressBar={{ percent: memory.usagePercentage || 0 }} 
                        details={[
                            {label: '사용률', value: `${memory.usagePercentage || 0}%`},
                            {label: '여유', value: formatBytes(memory.free || 0)}
                        ]}
                    />
                    <StatCard 
                        icon="fa-hdd" 
                        title="디스크 사용률" 
                        value={`${disk.usagePercentage || 0}%`} 
                        progressBar={{ percent: disk.usagePercentage || 0 }} 
                        details={[
                            {label: '사용', value: formatBytes(disk.used || 0)},
                            {label: '전체', value: formatBytes(disk.total || 0)}
                        ]}
                    />
                    <StatCard 
                        icon="fa-network-wired" 
                        title="네트워크" 
                        value="" 
                        details={[
                            {label: 'TX', value: `${network.txPerSecond || 0} MB/s`},
                            {label: 'RX', value: `${network.rxPerSecond || 0} MB/s`},
                            {label: 'Uptime', value: formatUptime(metrics?.uptime || 0)}
                        ]}
                    />
                </div>
                <div className="mt-6 widget-card p-6 rounded-xl">
                    <h4 className="text-lg font-semibold text-white mb-4">실시간 사용률 (5초 간격)</h4>
                    <div className="chart-container" style={{ height: '250px' }}>
                        <Line ref={chartRef} data={chartData} options={chartOptions} />
                    </div>
                </div>
            </section>

            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">서비스 상태</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ServiceCard 
                        icon="fa-server text-blue-400" 
                        name="API 서버" 
                        type={metrics?.os?.platform || 'NestJS'} 
                        status={metrics ? "Running" : "Unknown"} 
                        details={[
                            {label: 'OS', value: metrics?.os?.distro || '-'},
                            {label: '호스트', value: metrics?.os?.hostname || '-'},
                            {label: '업타임', value: formatUptime(metrics?.uptime || 0)}
                        ]} 
                    />
                    <ServiceCard 
                        icon="fa-database text-green-400" 
                        name="데이터베이스" 
                        type="PostgreSQL" 
                        status={metrics ? "Running" : "Unknown"} 
                        details={[
                            {label: '상태', value: metrics ? '정상' : '-'},
                            {label: '연결', value: metrics ? '활성' : '-'},
                            {label: '호스트', value: metrics?.os?.hostname || '-'}
                        ]} 
                    />
                    <ServiceCard 
                        icon="fa-desktop text-purple-400" 
                        name="프론트엔드" 
                        type="React App" 
                        status="Running" 
                        details={[
                            {label: '상태', value: '정상'},
                            {label: '메모리', value: formatBytes(memory.active || 0)},
                            {label: '사용률', value: `${memory.usagePercentage || 0}%`}
                        ]} 
                    />
                </div>
            </section>

            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">시스템 제어</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ControlCard 
                        icon="fa-power-off" 
                        title="서버 재시작" 
                        description="API 서버를 재시작합니다" 
                        buttonText="재시작" 
                        buttonIcon="fa-power-off" 
                        onAction={handleServerRestart} 
                        statusText={formatUptime(metrics?.uptime || 0) + ' 업타임'} 
                        colorClass="text-red-400" 
                        loading={actionLoading.restart}
                    />
                    <ControlCard 
                        icon="fa-info-circle" 
                        title="시스템 정보" 
                        description="서버 환경 정보" 
                        buttonText="새로고침" 
                        buttonIcon="fa-sync" 
                        onAction={fetchMetrics} 
                        statusText={`${metrics?.os?.platform || '-'} / ${metrics?.os?.release || '-'}`} 
                        colorClass="text-blue-400"
                    />
                </div>
            </section>
        </div>
    );
};

export default AdminServer;