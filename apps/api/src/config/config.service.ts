import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env.schema';
import type { TokenDuration } from '@/modules/auth/auth.types';

/**
 * Typed accessor over the validated environment.
 *
 * Injecting this rather than the raw ConfigService means callers get real
 * types and cannot typo a key into `undefined` at runtime.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get port(): number {
    return this.get('PORT');
  }

  get apiPrefix(): string {
    return this.get('API_PREFIX');
  }

  /**
   * Explicit allowlist. Never `origin: '*'` alongside credentials
   * (PROJECT_PLAN.md §12.3).
   */
  get corsOrigins(): string[] {
    return [
      this.get('STOREFRONT_ORIGIN'),
      this.get('ADMIN_ORIGIN'),
      ...(this.get('EXTRA_CORS_ORIGINS') ?? []),
    ];
  }

  get jwt() {
    return {
      accessSecret: this.get('JWT_ACCESS_SECRET'),
      accessExpiry: this.get('JWT_ACCESS_EXPIRY') as TokenDuration,
      refreshSecret: this.get('JWT_REFRESH_SECRET'),
      refreshExpiry: this.get('JWT_REFRESH_EXPIRY') as TokenDuration,
      bcryptRounds: this.get('BCRYPT_ROUNDS'),
      cookieDomain: this.get('COOKIE_DOMAIN'),
      cookieCrossSite: this.get('COOKIE_CROSS_SITE'),
    };
  }

  get cloudinary() {
    return {
      cloudName: this.get('CLOUDINARY_CLOUD_NAME'),
      apiKey: this.get('CLOUDINARY_API_KEY'),
      apiSecret: this.get('CLOUDINARY_API_SECRET'),
      folder: this.get('CLOUDINARY_UPLOAD_FOLDER'),
    };
  }

  get revalidation() {
    return {
      url: this.get('STOREFRONT_REVALIDATE_URL'),
      secret: this.get('REVALIDATE_SECRET'),
    };
  }

  get mail() {
    return {
      host: this.get('SMTP_HOST'),
      port: this.get('SMTP_PORT'),
      user: this.get('SMTP_USER'),
      password: this.get('SMTP_PASSWORD'),
      from: this.get('MAIL_FROM'),
      notifyTo: this.get('QUOTATION_NOTIFY_TO'),
      enabled: this.get('QUOTATION_NOTIFY_ENABLED'),
    };
  }

  get turnstile() {
    return {
      secretKey: this.get('TURNSTILE_SECRET_KEY'),
      enabled: this.get('TURNSTILE_ENABLED'),
    };
  }
}
