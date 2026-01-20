import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const StatCard = ({ icon, title, value, details, progressBar }) => (
    <div className="widget-card p-6 rounded-xl">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2"><i className={`fas ${icon} text-blue-400`}></i><h5 className="font-semibold text-gray-300">{title}</h5></div>
            {value && <span className="text-lg font-bold text-white">{value}</span>}
        </div>
        {progressBar && <div className="progress-bar h-3 mb-2"><div className="progress-bar-inner" style={{ width: `${progressBar.percent}%` }}></div></div>}
        {details && <div className="text-xs text-gray-400 space-y-1">{details.map(d => <div key={d.label}>{d.label}: {d.value}</div>)}</div>}
    </div>
);

const ServiceCard = ({ icon, name, type, status, details, onAction }) => (
    <div className="service-card">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3"><i className={`fas ${icon} text-2xl`}></i>
                <div><h5 className="font-bold text-white">{name}</h5><p className="text-sm text-gray-400">{type}</p></div>
            </div>
            <span className={`status-indicator status-${status.toLowerCase()}`}><i className="fas fa-circle mr-1"></i>{status}</span>
        </div>
        <div className="space-y-2 mb-4">{details.map(d => <div key={d.label} className="flex justify-between text-sm"><span className="text-gray-400">{d.label}:</span><span className="text-white">{d.value}</span></div>)}</div>
        <div className="flex space-x-2">
            <button className="btn-success text-xs flex-1" onClick={() => onAction('restart', name)}><i className="fas fa-redo mr-1"></i>재시작</button>
            <button className="btn-secondary text-xs" onClick={() => onAction('logs', name)}><i className="fas fa-file-alt mr-1"></i>로그</button>
        </div>
    </div>
);

const ControlCard = ({ icon, title, description, buttonText, buttonIcon, onAction, statusText, colorClass }) => (
    <div className="widget-card p-6 rounded-xl">
        <div className="flex items-center space-x-3 mb-4"><i className={`fas ${icon} ${colorClass} text-2xl`}></i>
            <div><h5 className="font-bold text-white">{title}</h5><p className="text-sm text-gray-400">{description}</p></div>
        </div>
        <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm text-gray-300">현재 상태:</span><span className={`text-sm ${statusText.includes('비활성') ? 'text-green-400' : 'text-yellow-400'}`}>{statusText}</span></div>
            <button className={`btn-warning w-full`} onClick={onAction}><i className={`fas ${buttonIcon} mr-2`}></i>{buttonText}</button>
        </div>
    </div>
);

const AdminServer = () => {
    const [metrics, setMetrics] = useState({ cpu: 42, ram: 6.8, disk: 75, networkTx: 15.2, networkRx: 88.4, temp: 58, uptime: '42d 11h 5m' });
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [logs, setLogs] = useState([]);

    const addLog = useCallback((action, type) => {
        setLogs(prev => [{ time: new Date().toLocaleString(), action, type }, ...prev.slice(0, 9)]);
    }, []);

    const chartData = useMemo(() => ({
        labels: Array.from({ length: 20 }, (_, i) => i),
        datasets: [
            { label: 'CPU 사용률 (%)', data: Array.from({length: 20}, () => Math.random() * 100), borderColor: '#a8c5e6', tension: 0.4 },
            { label: '메모리 사용률 (%)', data: Array.from({length: 20}, () => Math.random() * 100), borderColor: '#c5a8e6', tension: 0.4 },
        ],
    }), []);

    const handleControlAction = (action) => {
        if (window.confirm(`${action} 작업을 실행하시겠습니까?`)) {
            if (action === 'maintenance') setMaintenanceMode(!maintenanceMode);
            addLog(`${action} 작업 실행`, 'warning');
        }
    };

    return (
        <div className="container mx-auto max-w-7xl p-6">
            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">서버 상태 모니터링</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon="fa-microchip" title="CPU 사용률" value={`${Math.round(metrics.cpu)}%`} progressBar={{ percent: metrics.cpu }} details={[{label: 'Load Avg', value: '1.2, 1.5, 1.8'}, {label: 'Temp', value: `${metrics.temp}°C`}]}/>
                    <StatCard icon="fa-memory" title="메모리 사용률" value={`${metrics.ram.toFixed(1)}GB/16GB`} progressBar={{ percent: (metrics.ram / 16) * 100 }} details={[{label: 'Available', value: `${(16 - metrics.ram).toFixed(1)}GB`}, {label: 'Cached', value: '2.1GB'}]}/>
                    <StatCard icon="fa-hdd" title="디스크 사용률" value={`${metrics.disk}%`} progressBar={{ percent: metrics.disk }} details={[{label: 'Used', value: '180GB / 240GB'}, {label: 'Free', value: '60GB'}]}/>
                    <StatCard icon="fa-network-wired" title="네트워크" value={``} details={[{label: 'TX', value: `${metrics.networkTx.toFixed(1)} Mbps`}, {label: 'RX', value: `${metrics.networkRx.toFixed(1)} Mbps`}, {label: 'Uptime', value: metrics.uptime}]}/>
                </div>
                <div className="mt-6 widget-card p-6 rounded-xl"><div className="chart-container"><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} /></div></div>
            </section>

            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">서비스 상태</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ServiceCard icon="fa-server text-blue-400" name="API 서버" type="NestJS" status="Running" details={[{label: '버전', value: 'v1.2.3'}, {label: '포트', value: '3000'}, {label: '응답시간', value: '24ms'}]} onAction={handleControlAction} />
                    <ServiceCard icon="fa-database text-green-400" name="데이터베이스" type="PostgreSQL" status="Running" details={[{label: '버전', value: '15.2'}, {label: '연결', value: '8/100'}, {label: '크기', value: '2.4GB'}]} onAction={handleControlAction} />
                    <ServiceCard icon="fa-memory text-red-400" name="Redis" type="Cache Server" status="Running" details={[{label: '버전', value: '7.0.5'}, {label: '메모리', value: '156MB'}, {label: '키', value: '1,247'}]} onAction={handleControlAction} />
                    <ServiceCard icon="fa-desktop text-purple-400" name="프론트엔드" type="React App" status="Running" details={[{label: '버전', value: 'v2.1.0'}, {label: '빌드', value: '#247'}, {label: 'CDN', value: '활성'}]} onAction={handleControlAction} />
                </div>
            </section>

            <section className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-6">제어 작업</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ControlCard icon="fa-tools" title="유지보수 모드" description="사용자 접근 제한" buttonText={maintenanceMode ? "비활성화" : "활성화"} buttonIcon={maintenanceMode ? "fa-toggle-on" : "fa-toggle-off"} onAction={() => handleControlAction('maintenance')} statusText={maintenanceMode ? '활성' : '비활성'} colorClass="text-yellow-400" />
                    <ControlCard icon="fa-broom" title="캐시 관리" description="Redis 캐시 제어" buttonText="전체 삭제" buttonIcon="fa-trash" onAction={() => handleControlAction('clearCache')} statusText="1,247개 키" colorClass="text-blue-400" />
                    <ControlCard icon="fa-database" title="DB 백업" description="데이터베이스 스냅샷" buttonText="백업 생성" buttonIcon="fa-download" onAction={() => handleControlAction('backup')} statusText="2시간 전" colorClass="text-green-400" />
                    <ControlCard icon="fa-power-off" title="시스템 재시작" description="전체 서버 재부팅" buttonText="재시작" buttonIcon="fa-power-off" onAction={() => handleControlAction('restartSystem')} statusText="42일 업타임" colorClass="text-red-400" />
                </div>
            </section>
        </div>
    );
};

export default AdminServer;