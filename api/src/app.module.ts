import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { MembersModule } from './members/members.module';
import { AdminMembersModule } from './admin/members/admin-members.module';
import { AnnouncementModule } from './announcement/announcement.module';
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
import { LoggerModule } from './logger/logger.module';
import { HttpLoggerMiddleware } from './logger/http-logger.middleware';
import { RecruitmentModule } from './recruitment/recruitment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../envs/api.env'],
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST') || 'localhost',
        port: config.get<number>('DB_PORT') || 5432,
        username: config.get<string>('DB_USERNAME') || 'user',
        password: config.get<string>('DB_PASSWORD') || 'password',
        database: config.get<string>('DB_DATABASE') || 'mydb',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true, // 개발 중에만 true
        logging: true,
      }),
    }),
    AuthModule,
    MembersModule,
    AdminMembersModule,
    AnnouncementModule,
    TeamsModule,
    StudyModule,
    ActivityImagesModule,
    AdminSystemModule,
    JobsModule,
    LoggerModule,
    ProfileModule,
    PrivacyModule,
    WithdrawModule,
    MyPageTeamsModule,
    RecruitmentModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
