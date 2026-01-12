// Jest e2e 테스트 설정
import { config } from 'dotenv';

// 테스트 환경 설정
config({ path: '../envs/api.env' });

// 환경변수 오버라이드 (테스트 전용)
process.env.NODE_ENV = 'test';

// Logstash 비활성화 (테스트 환경)
process.env.LOGSTASH_HOST = '';
process.env.LOGSTASH_PORT = '';

// 글로벌 타임아웃 설정
jest.setTimeout(60000);
