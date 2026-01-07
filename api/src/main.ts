import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as path from 'path';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // 기본 로거 비활성화 (Winston으로 대체)
    bufferLogs: true,
  });

  // Winston 로거를 NestJS 글로벌 로거로 설정
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Cookie Parser 미들웨어 추가 (HttpOnly 쿠키 파싱)
  app.use(cookieParser());

  // 정적 파일 서빙 (uploads 폴더)
  app.useStaticAssets(path.join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // CORS 설정 (credentials: true로 쿠키 전송 허용)
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(`Application is running on port ${port}`, 'Bootstrap');
}
bootstrap();
