import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  
  // Liveness: 프로세스 생존 여부만
  liveness() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  
  // Readiness: 핵심 의존성만 확인
  async readiness(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  // Status: 사람 관측용 (확장 자유)
  async status() {
    const checks: any = {};

    // DB 상태
    const dbStart = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      checks.database = {
        status: 'ok',
        responseTime: Date.now() - dbStart,
      };
    } catch (e) {
      checks.database = {
        status: 'error',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }

    // 메모리 상태
    const mem = process.memoryUsage();
    const used = mem.heapUsed;
    const total = mem.heapTotal;

    checks.memory = {
      used,
      total,
      percentage: Math.round((used / total) * 10000) / 100,
    };

    return {
      status: checks.database.status === 'ok' ? 'ok' : 'error',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
