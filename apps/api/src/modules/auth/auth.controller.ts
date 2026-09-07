import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { AppConfigService } from '@/config/config.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { AllowDuringPasswordChange } from './decorators/allow-password-change.decorator';
import { CurrentUser, type AuthenticatedAdmin } from './decorators/current-user.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { clearAuthCookies, durationToMs, setAuthCookies } from './auth.cookies';
import type { RefreshRequestUser } from './strategies/jwt-refresh.strategy';
import type { TokenPair } from './auth.types';

@ApiTags('Admin — auth')
@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Rate limited to 5 attempts per 15 minutes per IP (PROJECT_PLAN.md §12.2).
   * The whole point of a strict limit here is that the seeded credential is a
   * documented default until it is rotated.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in and receive httpOnly auth cookies' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { user, tokens, mustChangePassword } = await this.auth.login(dto.email, dto.password);
    this.writeCookies(response, tokens);
    return { user, mustChangePassword };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token and reissue the pair' })
  async refresh(
    @CurrentUser() user: RefreshRequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokens = await this.auth.refresh(user.id, user.refreshToken);
    this.writeCookies(response, tokens);
    return { refreshed: true };
  }

  @AllowDuringPasswordChange()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidate the refresh token and clear cookies' })
  async logout(
    @CurrentUser() user: AuthenticatedAdmin,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(user.id);
    clearAuthCookies(response, {
      isProduction: this.config.isProduction,
      domain: this.config.jwt.cookieDomain,
      crossSite: this.config.jwt.cookieCrossSite,
    });
    return { loggedOut: true };
  }

  @AllowDuringPasswordChange()
  @Get('me')
  @ApiOperation({ summary: 'Current admin profile' })
  async me(@CurrentUser() user: AuthenticatedAdmin) {
    return this.auth.getProfile(user.id);
  }

  /**
   * Reachable while `mustChangePassword` is true — it is the only route that
   * has to be, since it is how the flag gets cleared.
   */
  @AllowDuringPasswordChange()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password (required on first sign-in)' })
  async changePassword(
    @CurrentUser() user: AuthenticatedAdmin,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user: updated, tokens } = await this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    this.writeCookies(response, tokens);
    return { user: updated, mustChangePassword: false };
  }

  private writeCookies(response: Response, tokens: TokenPair): void {
    setAuthCookies(response, tokens, {
      isProduction: this.config.isProduction,
      domain: this.config.jwt.cookieDomain,
      crossSite: this.config.jwt.cookieCrossSite,
      accessMaxAgeMs: durationToMs(this.config.jwt.accessExpiry),
      refreshMaxAgeMs: durationToMs(this.config.jwt.refreshExpiry),
    });
  }
}
