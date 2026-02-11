import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { MembersModule } from './members/members.module';
import { AdminMembersModule } from './admin/members/admin-members.module';
import { AnnouncementModule } from './announcement/announcement.module';
import { AdminAnnouncementModule } from './admin/announcement/admin-announcement.module';
import { TeamsModule } from './teams/teams.module';
import { StudyModule } from './study/study.module';
import { ActivityImagesModule } from './admin/activity-images/activity-images.module';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsModule } from './jobs/jobs.module';
import { AdminSystemModule } from './admin/system/admin-system.module';
import { ProfileModule } from './mypage/profile/profile.module';
import { PrivacyModule } from './mypage/privacy/privacy.module';
import { WithdrawModule } from './mypage/withdraw/withdraw.module';
import { MyPageTeamsModule } from './mypage/teams/mypage-teams.module';
import { MyPageStudyModule } from './mypage/study/mypage-study.module';
import { AccountModule } from './mypage/account/account.module';
import { LoggerModule } from './logger/logger.module';
import { HttpLoggerMiddleware } from './logger/http-logger.middleware';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { HealthModule } from './health/health.module';
import { AdminStatisticsModule } from './admin/statistics/admin-statistics.module';
import { MainPageModule } from './main-page/main-page.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../envs/api.env'],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/',
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST') || 'localhost',
        port: config.get<number>('DB_PORT') || 5432,
        username: config.get<string>('DB_USER') || 'user',
        password: config.get<string>('DB_PASSWORD') || 'password',
        database: config.get<string>('DB_NAME') || 'mydb',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // 프로덕션에서는 반드시 false
        logging: true,
      }),
    }),
    AuthModule,
    MembersModule,
    AdminMembersModule,
    AnnouncementModule,
    AdminAnnouncementModule,
    TeamsModule,
    StudyModule,
    ActivityImagesModule,
    AdminSystemModule,
    JobsModule,
    LoggerModule,
    ProfileModule,
    PrivacyModule,
    WithdrawModule,
    MyPageStudyModule,
    MyPageTeamsModule,
    AccountModule,
    RecruitmentModule,
    HealthModule,
    AdminStatisticsModule,
    MainPageModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
