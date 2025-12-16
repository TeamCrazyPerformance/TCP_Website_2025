import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { User } from '../members/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, RefreshPayload, SanitizedUser } from './types';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) { }

  private sanitize(user: User): SanitizedUser {
    const { id, username, name, email, student_number, profile_image, role, created_at, updated_at } = user;
    return { id, username, name, email, student_number, profile_image, role, created_at, updated_at };
  }

  private async generateTokens(user: User) {
    const secret = this.config.get<string>('JWT_SECRET');

    // Access Token: 15분
    const accessPayload: JwtPayload = { sub: user.id, username: user.username, role: user.role };
    const access_token = await this.jwt.signAsync(accessPayload, {
      secret,
      expiresIn: '15m',
    });

    // Refresh Token: 7일
    const refreshPayload: RefreshPayload = { sub: user.id, type: 'refresh' };
    const refresh_token = await this.jwt.signAsync(refreshPayload, {
      secret,
      expiresIn: '7d',
    });

    // Refresh Token을 DB에 저장
    await this.usersRepo.update(user.id, { refresh_token });

    return { access_token, refresh_token };
  }

  async register(dto: RegisterDto) {
    // username / email / student_number 중복검사
    const [byUsername, byEmail, byStdNo] = await Promise.all([
      this.usersRepo.findOne({ where: { username: dto.username } }),
      this.usersRepo.findOne({ where: { email: dto.email } }),
      this.usersRepo.findOne({ where: { student_number: dto.student_number } }),
    ]);

    if (byUsername) throw new ConflictException('이미 있는 아이디입니다.');
    if (byEmail) throw new ConflictException('이미 있는 이메일입니다.');
    if (byStdNo) throw new ConflictException('이미 있는 학번입니다.');

    const saltRounds = Number(this.config.get('BCRYPT_SALT_ROUNDS') ?? 12);
    const hashed = await bcrypt.hash(dto.password, saltRounds);

    const entity = this.usersRepo.create({
      ...dto,
      password: hashed,
      birth_date: new Date(dto.birth_date),
      tech_stack: dto.tech_stack ?? null,
      profile_image: dto.profile_image ?? 'default_profile_image.png',
      is_public_current_company: dto.is_public_current_company ?? false,
      is_public_github_username: dto.is_public_github_username ?? false,
      is_public_baekjoon_username: dto.is_public_baekjoon_username ?? false,
      is_public_email: dto.is_public_email ?? false,
    });

    const saved = await this.usersRepo.save(entity);
    const tokens = await this.generateTokens(saved);

    return {
      user: this.sanitize(saved),
      ...tokens,
    };
  }

  async validateUser(username: string, password: string) {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :username', { username })
      .getOne();

    if (!user) throw new UnauthorizedException('invalid credentials');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('invalid credentials');

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.username, dto.password);
    const tokens = await this.generateTokens(user);
    return { user: this.sanitize(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    try {
      const secret = this.config.get<string>('JWT_SECRET');
      const payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, { secret });

      // refresh 토큰인지 확인
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
      }

      // DB에서 사용자 정보 및 저장된 refresh token 조회
      const user = await this.usersRepo
        .createQueryBuilder('user')
        .addSelect('user.refresh_token')
        .where('user.id = :id', { id: payload.sub })
        .getOne();

      if (!user) {
        throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
      }

      // DB에 저장된 refresh token과 일치하는지 확인
      if (user.refresh_token !== refreshToken) {
        throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
      }

      const tokens = await this.generateTokens(user);
      return { user: this.sanitize(user), ...tokens };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('refresh token이 만료되었거나 유효하지 않습니다.');
    }
  }

  async logout(userId: number) {
    // DB에서 refresh token 삭제
    await this.usersRepo.update(userId, { refresh_token: null });
    return { message: '로그아웃 되었습니다.' };
  }
}
