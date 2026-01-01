import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
