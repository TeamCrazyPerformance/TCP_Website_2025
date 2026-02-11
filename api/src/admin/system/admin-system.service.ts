import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as si from 'systeminformation';
import * as os from 'os';
import { User } from '../../members/entities/user.entity';
import { Study } from '../../study/entities/study.entity';

@Injectable()
export class AdminSystemService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Study)
        private readonly studyRepository: Repository<Study>,
    ) { }

    async getDashboardStats() {
        // Get member counts by education_status
        const members = await this.userRepository.find({
            where: { deleted_at: IsNull() },
            select: ['education_status'],
        });

        const memberCounts = {
            total: members.length,
            enrolled: members.filter(m => m.education_status === '재학').length,
            onLeave: members.filter(m => m.education_status === '휴학').length,
            graduated: members.filter(m => m.education_status === '졸업').length,
            other: members.filter(m => !['재학', '휴학', '졸업'].includes(m.education_status || '')).length,
        };

        // Get study counts
        const studies = await this.studyRepository.find();
        const currentYear = new Date().getFullYear();

        const studyCounts = {
            total: studies.length,
            // Studies from current year are considered "in progress"
            inProgress: studies.filter(s => s.start_year === currentYear).length,
            completed: studies.filter(s => s.start_year < currentYear).length,
        };

        return {
            members: memberCounts,
            studies: studyCounts,
        };
    }

    async getSystemStats() {
        try {
            const cpu = await si.currentLoad();
            const cpuTemp = await si.cpuTemperature();
            const mem = await si.mem();
            const disk = await si.fsSize();
            const osInfo = await si.osInfo();
            const networkStats = await si.networkStats();

            // 전체 디스크 용량 계산 (메인 드라이브 기준 또는 전체 합산)
            // 여기서는 첫 번째 마운트된 디스크를 메인으로 가정하거나 전체 합산을 사용할 수 있음
            const mainDisk = disk.length > 0 ? disk[0] : { size: 0, used: 0, use: 0 };

            // Network stats - sum all interfaces or use first one
            const totalTx = networkStats.reduce((sum, net) => sum + (net.tx_sec || 0), 0);
            const totalRx = networkStats.reduce((sum, net) => sum + (net.rx_sec || 0), 0);

            const uptimeSeconds = os.uptime();

            return {
                cpu: {
                    manufacturer: os.cpus()[0].model,
                    cores: os.cpus().length,
                    usagePercentage: parseFloat(cpu.currentLoad.toFixed(2)),
                    temperature: cpuTemp.main || null, // May be null in Docker
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
                network: {
                    txPerSecond: parseFloat((totalTx / 1024 / 1024).toFixed(2)), // MB/s
                    rxPerSecond: parseFloat((totalRx / 1024 / 1024).toFixed(2)), // MB/s
                },
                os: {
                    platform: osInfo.platform,
                    distro: osInfo.distro,
                    release: osInfo.release,
                    hostname: osInfo.hostname,
                },
                uptime: uptimeSeconds,
                serverTime: new Date().toISOString(), // Actual server time
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

