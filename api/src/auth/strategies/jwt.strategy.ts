import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../types';
import { User } from '../../members/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'JWT_SECRET',
    });
  }

  async validate(payload: JwtPayload & { type?: string }) {
    // 1. Refresh token은 API 접근에 사용 불가
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Access token이 필요합니다.');
    }

    // 2. 로그아웃된 사용자인지 확인 (refresh_token이 null이면 로그아웃 상태)
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.refresh_token')
      .where('user.id = :id', { id: payload.sub })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    if (!user.refresh_token) {
      throw new UnauthorizedException('로그아웃된 상태입니다. 다시 로그인해주세요.');
    }

    // request.user에 들어감
    return { userId: payload.sub, username: payload.username, role: payload.role };
  }
}
