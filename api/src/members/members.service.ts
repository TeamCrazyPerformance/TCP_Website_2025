import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { User } from './entities/user.entity';
import { PublicUserDto } from './dto/public-user.dto';
import { UserRole } from './entities/enums/user-role.enum';

@Injectable()
export class MembersService {
  private readonly profilesPath = path.join(process.cwd(), 'uploads', 'profiles');

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    // uploads/profiles 디렉토리 생성
    this.ensureProfilesDir();
  }

  private ensureProfilesDir(): void {
    if (!fs.existsSync(this.profilesPath)) {
      fs.mkdirSync(this.profilesPath, { recursive: true });
    }
  }

  async getPublicMemberList(): Promise<PublicUserDto[]> {
    const users = await this.userRepository.find({
      where: {
        deleted_at: IsNull(),
        role: Not(UserRole.GUEST),
      },
    });
    return users.map((user) => ({
      name: user.name,
      profile_image: user.profile_image,
      self_description: user.self_description,
      ...(user.is_public_email && { email: user.email }),
      ...(user.is_public_tech_stack && { tech_stack: user.tech_stack }),
      ...(user.is_public_education_status && { education_status: user.education_status }),
      ...(user.is_public_github_username && { github_username: user.github_username }),
      ...(user.is_public_portfolio_link && { portfolio_link: user.portfolio_link }),
    }));
  }

  /**
   * @description 사용자의 프로필 이미지를 업데이트합니다.
   * @param userId 사용자 ID
   * @param file 업로드된 파일
   * @returns 업데이트된 프로필 이미지 경로
   */
  async updateProfileImage(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ profile_image: string }> {
    // 1. 사용자 조회
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // 2. 기존 프로필 이미지 삭제 (기본 이미지가 아닌 경우만)
    if (user.profile_image && user.profile_image !== 'default_profile_image.png') {
      const oldImagePath = path.join(this.profilesPath, user.profile_image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // 3. 새 파일명 생성 (userId.확장자)
    const ext = path.extname(file.originalname).toLowerCase();
    const newFileName = `${userId}${ext}`;
    const newFilePath = path.join(this.profilesPath, newFileName);

    // 4. Multer가 저장한 임시 파일을 새 경로로 이동
    fs.renameSync(file.path, newFilePath);

    // 5. DB에 프로필 이미지 경로 업데이트
    user.profile_image = newFileName;
    await this.userRepository.save(user);

    return { profile_image: `/uploads/profiles/${newFileName}` };
  }
}
