import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { User } from '../members/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, SanitizedUser } from './types';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private sanitize(user: User): SanitizedUser {
    const { id, username, name, email, student_number, profile_image, created_at, updated_at } = user;
    return { id, username, name, email, student_number, profile_image, created_at, updated_at };
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
      is_public_github_username: dto.is_public_github_username ?? false,
      is_public_email: dto.is_public_email ?? false,
    });

    const saved = await this.usersRepo.save(entity);

    const payload: JwtPayload = { sub: saved.id, username: saved.username };
    const access_token = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') || '1d',
    });

    return {
      user: this.sanitize(saved),
      access_token,
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
    const payload: JwtPayload = { sub: user.id, username: user.username };
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') || '1d',
    });
    return { user: this.sanitize(user), access_token: token };
  }
}
