import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { MembersModule } from './members/members.module';
import { AdminMembersModule } from './admin/members/admin-members.module';
import { AnnouncementModule } from './announcement/announcement.module';
import { TeamsModule } from './teams/teams.module';
import { StudyModule } from './study/study.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
  ],
})
export class AppModule {}
