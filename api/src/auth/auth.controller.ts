import { Body, Controller, Post, UseGuards, Request, Req, Res, UsePipes, ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { Response, Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// 쿠키 옵션 상수
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,           // JavaScript에서 접근 불가 (XSS 방지)
  secure: process.env.NODE_ENV === 'production', // 프로덕션에서만 HTTPS 필수
  sameSite: 'strict' as const, // CSRF 방지
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7일 (밀리초)
  path: '/',                // 모든 경로에서 전송 (필요시 '/auth'로 제한 가능)
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);

    // Refresh Token을 HttpOnly 쿠키로 설정
    res.cookie('refresh_token', result.refresh_token, REFRESH_TOKEN_COOKIE_OPTIONS);

    // 응답에서 refresh_token 제거 (쿠키로만 전달)
    const { refresh_token, ...response } = result;
    return response;
  }

  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    // Refresh Token을 HttpOnly 쿠키로 설정
    res.cookie('refresh_token', result.refresh_token, REFRESH_TOKEN_COOKIE_OPTIONS);

    // 응답에서 refresh_token 제거 (쿠키로만 전달)
    const { refresh_token, ...response } = result;
    return response;
  }

  @Post('refresh')
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 쿠키에서 refresh_token 읽기
    const refreshToken = req.cookies?.['refresh_token'];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token이 없습니다.');
    }

    const result = await this.authService.refresh(refreshToken);

    // 새 Refresh Token을 HttpOnly 쿠키로 설정 (Token Rotation)
    res.cookie('refresh_token', result.refresh_token, REFRESH_TOKEN_COOKIE_OPTIONS);

    // 응답에서 refresh_token 제거
    const { refresh_token, ...response } = result;
    return response;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Request() req,
    @Req() expressReq: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 쿠키에서 refresh_token 읽기 (현재 디바이스만 로그아웃)
    const refreshToken = expressReq.cookies?.['refresh_token'];
    const result = await this.authService.logout(req.user.userId, refreshToken);

    // 쿠키 삭제
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return result;
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logoutAll(req.user.userId);

    // 쿠키 삭제
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return result;
  }
}
