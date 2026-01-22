import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

describe('Health endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health/live', () => {
    it('should return 200', async () => {
      await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when DB is connected', async () => {
      await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);
    });
  });


  describe('GET /health/status', () => {
    it('should return status object', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/status')
        .expect(200);

      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('checks');
    });
  });
});
