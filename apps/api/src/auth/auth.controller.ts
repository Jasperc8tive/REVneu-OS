import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { AuthService, AuthResponse, LoginDto, RefreshTokenDto, RegisterDto } from './services/auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { User } from './decorators/user.decorator'
import type { JwtPayload } from './strategies/jwt.strategy'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto, @Req() req: Request): Promise<AuthResponse> {
    const ipAddress = req.ip ||
      req.headers['x-forwarded-for'] as string ||
      req.socket.remoteAddress
    return this.authService.register(dto, ipAddress)
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponse> {
    const ipAddress = req.ip ||
      req.headers['x-forwarded-for'] as string ||
      req.socket.remoteAddress
    return this.authService.login(dto, ipAddress)
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<AuthResponse> {
    const ipAddress = req.ip ||
      req.headers['x-forwarded-for'] as string ||
      req.socket.remoteAddress
    return this.authService.refreshToken(dto, ipAddress)
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async logout(@User() user: JwtPayload): Promise<void> {
    if (user.sessionId) {
      await this.authService.logout(user.sessionId)
    }
  }
}
