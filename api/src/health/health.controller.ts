import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // 프로세스 확인용
  @Get('live')
  live() {
    return this.healthService.liveness();
  }

  // DB 연결 확인용
  @Get('ready')
  async ready() {
    const isReady = await this.healthService.readiness();

    if (!isReady) {
      throw new ServiceUnavailableException('Service not ready');
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  // 운영 관측용(상세 상태 확인)
  @Get('status')
  async status() {
    return this.healthService.status();
  }
}
