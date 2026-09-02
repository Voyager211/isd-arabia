import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';

import { AdminUser, AdminUserSchema } from './admin-user.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

/**
 * Secrets are passed per-sign call in AuthService rather than registered here,
 * because access and refresh tokens are signed with different secrets.
 * A single module-level secret would make the two interchangeable.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: AdminUser.name, schema: AdminUserSchema }]),
    PassportModule.register({ session: false }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy, JwtRefreshStrategy],
  exports: [AuthService, MongooseModule],
})
export class AuthModule {}
