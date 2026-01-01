import { Injectable } from '@nestjs/common';
import * as si from 'systeminformation';
import * as os from 'os';

@Injectable()
export class AdminSystemService {
    async getSystemStats() {
        try {
            const cpu = await si.currentLoad();
            const mem = await si.mem();
            const disk = await si.fsSize();
            const osInfo = await si.osInfo();

            // 전체 디스크 용량 계산 (메인 드라이브 기준 또는 전체 합산)
            // 여기서는 첫 번째 마운트된 디스크를 메인으로 가정하거나 전체 합산을 사용할 수 있음
            const mainDisk = disk.length > 0 ? disk[0] : { size: 0, used: 0, use: 0 };

            const uptimeSeconds = os.uptime();

            return {
                cpu: {
                    manufacturer: os.cpus()[0].model,
                    cores: os.cpus().length,
                    usagePercentage: parseFloat(cpu.currentLoad.toFixed(2)),
                },
                memory: {
                    total: mem.total,
                    active: mem.active, // 사용 중인 메모리 (캐시 제외 등 실제 사용량에 가까움)
                    used: mem.used,     // 전체 사용량
                    free: mem.free,
                    usagePercentage: parseFloat(((mem.active / mem.total) * 100).toFixed(2)),
                },
                disk: {
                    total: mainDisk.size,
                    used: mainDisk.used,
                    usagePercentage: parseFloat(mainDisk.use.toFixed(2)),
                },
                os: {
                    platform: osInfo.platform,
                    distro: osInfo.distro,
                    release: osInfo.release,
                    hostname: osInfo.hostname,
                },
                uptime: uptimeSeconds,
            };
        } catch (error) {
            console.error('System stats error:', error);
            throw new Error('Failed to retrieve system statistics');
        }
    }

    restartServer() {
        // Docker 환경에서 프로세스 종료 시 자동 재시작됨 (restart: unless-stopped/always 정책 가정)
        setTimeout(() => {
            process.exit(1);
        }, 1000); // 응답을 보낼 시간을 주기 위해 1초 딜레이
        return { message: 'Server is restarting...' };
    }

    shutdownServer() {
        // Docker 환경에서 프로세스 종료 
        setTimeout(() => {
            process.exit(0);
        }, 1000);
        return { message: 'Server is shutting down...' };
    }
}
