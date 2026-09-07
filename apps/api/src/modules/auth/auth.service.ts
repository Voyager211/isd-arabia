import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

import type { AdminUser as AdminUserDto } from '@isd/shared-types';
import { AppConfigService } from '@/config/config.service';
import { AdminUser, AdminUserDocument } from './admin-user.schema';
import { checkPasswordPolicy } from './password.policy';
import type { AccessTokenPayload, RefreshTokenPayload, TokenPair } from './auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(AdminUser.name) private readonly adminModel: Model<AdminUserDocument>,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Verifies credentials and issues a token pair.
   *
   * The failure message is identical for "no such user", "wrong password" and
   * "deactivated account" (PROJECT_PLAN.md §11.2). Distinguishing them turns
   * the login form into an account-enumeration oracle.
   */
  async login(
    email: string,
    password: string,
  ): Promise<{ user: AdminUserDto; tokens: TokenPair; mustChangePassword: boolean }> {
    const generic = new UnauthorizedException('Invalid email address or password.');

    const admin = await this.adminModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();

    if (!admin || !admin.isActive) {
      // Hash a throwaway value so a missing account and a wrong password take
      // comparable time — otherwise response latency leaks which is which.
      await bcrypt.compare(
        password,
        '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva',
      );
      throw generic;
    }

    const matches = await bcrypt.compare(password, admin.passwordHash);
    if (!matches) throw generic;

    const tokens = await this.issueTokens(admin);
    await this.persistRefreshToken(String(admin._id), tokens.refreshToken);

    admin.lastLoginAt = new Date();
    await admin.save();

    return {
      user: this.toDto(admin),
      tokens,
      mustChangePassword: admin.mustChangePassword,
    };
  }

  /**
   * Rotates the refresh token. Each refresh issues a new pair and invalidates
   * the previous hash, so a stolen token is usable at most once and the theft
   * surfaces as an unexpected logout.
   */
  async refresh(adminId: string, presentedToken: string): Promise<TokenPair> {
    const admin = await this.adminModel.findById(adminId).select('+refreshTokenHash').exec();

    if (!admin || !admin.isActive || !admin.refreshTokenHash) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    const matches = this.refreshTokenMatches(presentedToken, admin.refreshTokenHash);
    if (!matches) {
      // The signature was valid but the hash is stale: either a replay of a
      // rotated-out token, or a second device. Drop the session either way.
      await this.adminModel.updateOne({ _id: adminId }, { refreshTokenHash: null }).exec();
      this.logger.warn(`Refresh token replay rejected for admin ${adminId}`);
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    const tokens = await this.issueTokens(admin);
    await this.persistRefreshToken(String(admin._id), tokens.refreshToken);
    return tokens;
  }

  async logout(adminId: string): Promise<void> {
    await this.adminModel.updateOne({ _id: adminId }, { refreshTokenHash: null }).exec();
  }

  async getProfile(adminId: string): Promise<AdminUserDto> {
    const admin = await this.adminModel.findById(adminId).exec();
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Account is no longer active.');
    }
    return this.toDto(admin);
  }

  /**
   * Changes a password and clears `mustChangePassword`.
   *
   * Every session is invalidated: the caller receives a fresh pair and any
   * other device holding the old refresh token is logged out.
   */
  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ user: AdminUserDto; tokens: TokenPair }> {
    const admin = await this.adminModel.findById(adminId).select('+passwordHash').exec();
    if (!admin) throw new UnauthorizedException('Account not found.');

    const matches = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!matches) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Current password is incorrect.',
        details: [{ field: 'currentPassword', message: 'Current password is incorrect.' }],
      });
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The new password must be different from the current one.',
        details: [{ field: 'newPassword', message: 'Choose a different password.' }],
      });
    }

    const policy = checkPasswordPolicy(newPassword);
    if (!policy.valid) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: policy.message,
        details: [{ field: 'newPassword', message: policy.message! }],
      });
    }

    admin.passwordHash = await this.hash(newPassword);
    admin.mustChangePassword = false;
    await admin.save();

    const tokens = await this.issueTokens(admin);
    await this.persistRefreshToken(String(admin._id), tokens.refreshToken);

    return { user: this.toDto(admin), tokens };
  }

  async hash(value: string): Promise<string> {
    return bcrypt.hash(value, this.config.jwt.bcryptRounds);
  }

  private async issueTokens(admin: AdminUserDocument): Promise<TokenPair> {
    const accessPayload: AccessTokenPayload = {
      sub: String(admin._id),
      email: admin.email,
      role: admin.role,
      mustChangePassword: admin.mustChangePassword,
    };
    // jti makes every issued refresh token unique — see RefreshTokenPayload.
    const refreshPayload: RefreshTokenPayload = {
      sub: String(admin._id),
      email: admin.email,
      jti: randomUUID(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.jwt.accessSecret,
        expiresIn: this.config.jwt.accessExpiry,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.jwt.refreshSecret,
        expiresIn: this.config.jwt.refreshExpiry,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Refresh tokens are stored as a SHA-256 digest, NOT a bcrypt hash.
   *
   * bcrypt silently truncates its input at 72 bytes. A JWT is far longer than
   * that and two tokens for the same admin share a long common prefix — same
   * header, same leading claims — so bcrypt hashes a rotated-out token and its
   * replacement to the same value. Rotation then does nothing and a stolen
   * token stays valid forever, which is the failure this project's own e2e
   * suite caught.
   *
   * A fast digest is also the right primitive here: bcrypt's cost exists to
   * slow down guessing a low-entropy human password. A 256-bit-entropy token
   * is not guessable, and the digest is only there so a database leak does not
   * hand over usable sessions.
   */
  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private refreshTokenMatches(presented: string, storedHash: string): boolean {
    const presentedHash = Buffer.from(this.hashRefreshToken(presented), 'hex');
    const stored = Buffer.from(storedHash, 'hex');

    // Length check first: timingSafeEqual throws on a length mismatch, which
    // would happen against a legacy bcrypt value written before this change.
    if (presentedHash.length !== stored.length) return false;
    return timingSafeEqual(presentedHash, stored);
  }

  private async persistRefreshToken(adminId: string, refreshToken: string): Promise<void> {
    await this.adminModel
      .updateOne({ _id: adminId }, { refreshTokenHash: this.hashRefreshToken(refreshToken) })
      .exec();
  }

  /** Never returns `passwordHash` or `refreshTokenHash`, both `select: false`. */
  private toDto(admin: AdminUserDocument): AdminUserDto {
    return {
      _id: String(admin._id),
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      mustChangePassword: admin.mustChangePassword,
      lastLoginAt: admin.lastLoginAt?.toISOString(),
      createdAt: (admin as unknown as { createdAt: Date }).createdAt.toISOString(),
      updatedAt: (admin as unknown as { updatedAt: Date }).updatedAt.toISOString(),
    };
  }
}
