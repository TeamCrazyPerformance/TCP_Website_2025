import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { User } from '../members/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, RefreshPayload, SanitizedUser } from './types';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) { }

  private sanitize(user: User): SanitizedUser {
    const { id, username, name, email, student_number, role, created_at, updated_at } = user;
    let profile_image: string | null = user.profile_image;

    if (profile_image && profile_image !== 'default_profile_image.png') {
      if (!profile_image.startsWith('http')) {
        profile_image = `/profiles/${profile_image}`;
      }
    } else {
      profile_image = null;
    }

    return { id, username, name, email, student_number, profile_image: profile_image as any, role, created_at, updated_at };
  }

  private async generateTokens(user: User, deviceInfo?: string) {
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

    // Refresh Token을 해시화하여 DB에 저장 (원문은 클라이언트에게만 전달)
    const saltRounds = Number(this.config.get('BCRYPT_SALT_ROUNDS') ?? 12);
    const hashedRefreshToken = await bcrypt.hash(refresh_token, saltRounds);

    // 새 RefreshToken 엔티티 생성 및 저장
    const tokenEntity = this.refreshTokenRepo.create({
      token_hash: hashedRefreshToken,
      user_id: user.id,
      device_info: deviceInfo ?? null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
      last_used_at: null,
    });
    await this.refreshTokenRepo.save(tokenEntity);

    return { access_token, refresh_token };
  }

  async register(dto: RegisterDto) {
    // username / email / student_number 중복검사
    const [byUsername, byEmail, byStdNo] = await Promise.all([
      this.usersRepo.findOne({ where: { username: dto.username }, withDeleted: true }),
      this.usersRepo.findOne({ where: { email: dto.email }, withDeleted: true }),
      this.usersRepo.findOne({ where: { student_number: dto.student_number }, withDeleted: true }),
    ]);

    if (byUsername) throw new ConflictException('이미 있는 아이디입니다.');
    if (byEmail) throw new ConflictException('이미 있는 이메일입니다.');
    if (dto.student_number && byStdNo) throw new ConflictException('이미 있는 학번입니다.');

    const saltRounds = Number(this.config.get('BCRYPT_SALT_ROUNDS') ?? 12);
    const hashed = await bcrypt.hash(dto.password, saltRounds);

    const entity = this.usersRepo.create({
      ...dto,
      password: hashed,
      birth_date: dto.birth_date ? new Date(dto.birth_date) : null,
      tech_stack: dto.tech_stack ?? null,
      profile_image: dto.profile_image ?? '/images/default_profile.webp',
      is_public_github_username: dto.is_public_github_username ?? false,
      is_public_email: dto.is_public_email ?? false,
    });

    const saved = await this.usersRepo.save(entity);
    const tokens = await this.generateTokens(saved);

    return {
      user: this.sanitize(saved),
      ...tokens,
    };
  }

  async checkUsernameAvailability(username: string): Promise<{ available: boolean }> {
    const existing = await this.usersRepo.findOne({
      where: { username },
      withDeleted: true,
    });
    return { available: !existing };
  }

  async checkEmailAvailability(email: string): Promise<{ available: boolean }> {
    const existing = await this.usersRepo.findOne({
      where: { email },
      withDeleted: true,
    });
    return { available: !existing };
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

  async login(dto: LoginDto, deviceInfo?: string) {
    const user = await this.validateUser(dto.username, dto.password);
    const tokens = await this.generateTokens(user, deviceInfo);
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

      // DB에서 사용자 정보 조회
      const user = await this.usersRepo.findOne({ where: { id: payload.sub } });

      if (!user) {
        throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
      }

      // 사용자의 모든 refresh token 조회
      const storedTokens = await this.refreshTokenRepo.find({
        where: { user_id: payload.sub },
      });

      if (storedTokens.length === 0) {
        throw new UnauthorizedException('로그아웃된 상태입니다. 다시 로그인해주세요.');
      }

      // 저장된 토큰들 중 일치하는 것 찾기
      let matchedToken: RefreshToken | null = null;
      for (const storedToken of storedTokens) {
        const isValid = await bcrypt.compare(refreshToken, storedToken.token_hash);
        if (isValid) {
          matchedToken = storedToken;
          break;
        }
      }

      if (!matchedToken) {
        // ⚠️ Reuse Detection: 토큰 불일치 시 탈취로 간주하고 전체 세션 무효화
        // 이전 토큰이 재사용되었을 가능성 → 모든 세션 즉시 폐기
        await this.refreshTokenRepo.delete({ user_id: user.id });
        throw new UnauthorizedException(
          '보안 위협이 감지되었습니다. 토큰이 탈취되었을 수 있습니다. 다시 로그인해주세요.'
        );
      }

      // 만료 여부 확인
      if (matchedToken.expires_at < new Date()) {
        await this.refreshTokenRepo.delete({ id: matchedToken.id });
        throw new UnauthorizedException('refresh token이 만료되었습니다.');
      }

      // 기존 토큰 삭제 (Token Rotation)
      await this.refreshTokenRepo.delete({ id: matchedToken.id });

      // 새 토큰 발급
      const tokens = await this.generateTokens(user, matchedToken.device_info ?? undefined);
      return { user: this.sanitize(user), ...tokens };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('refresh token이 만료되었거나 유효하지 않습니다.');
    }
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      // 특정 토큰만 삭제 (현재 디바이스만 로그아웃)
      const storedTokens = await this.refreshTokenRepo.find({
        where: { user_id: userId },
      });

      for (const storedToken of storedTokens) {
        const isValid = await bcrypt.compare(refreshToken, storedToken.token_hash);
        if (isValid) {
          await this.refreshTokenRepo.delete({ id: storedToken.id });
          break;
        }
      }
    } else {
      // 모든 토큰 삭제 (모든 디바이스에서 로그아웃)
      await this.refreshTokenRepo.delete({ user_id: userId });
    }
    return { message: '로그아웃 되었습니다.' };
  }

  async logoutAll(userId: string) {
    // 모든 디바이스에서 로그아웃
    await this.refreshTokenRepo.delete({ user_id: userId });
    return { message: '모든 기기에서 로그아웃 되었습니다.' };
  }
}
