import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';
import { TeamRole } from './entities/team-role.entity';
import { TeamMember } from './entities/team-member.entity';
import { User } from '../members/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamRole, TeamMember, User]),
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          // 서비스에서 디렉토리 생성 보장
          const uploadPath = './uploads/teams';
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = file.originalname.split('.').pop();
          cb(null, `team-${uniqueSuffix}.${ext}`);
        },
      }),
    }),
  ],
  controllers: [TeamsController],
  providers: [TeamsService]
})
export class TeamsModule {}
