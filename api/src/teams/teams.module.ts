import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';
import { TeamRole } from './entities/team-role.entity';
import { TeamMember } from './entities/team-member.entity';
import { User } from '../members/entities/user.entity';

// uploads/teams 디렉토리가 없으면 생성
const uploadPath = './uploads/teams';
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamRole, TeamMember, User]),
    MulterModule.register({
      storage: diskStorage({
        destination: uploadPath,
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
