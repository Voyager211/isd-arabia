import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '@/config/config.service';

/**
 * Cloudflare Turnstile verification (PROJECT_PLAN.md §12.3).
 *
 * Guards the two public write endpoints — quotation submission and catalogue
 * download — alongside a honeypot field and a per-IP rate limit. Three cheap
 * layers rather than one, because the cost of a spam quotation is a person's
 * time reading it.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: AppConfigService) {}

  /**
   * Throws `BadRequestException` when the token is missing or rejected.
   *
   * The env schema refuses to let `TURNSTILE_ENABLED` be false in production,
   * so the local escape hatch cannot reach a live deployment.
   */
  async verify(token: string | undefined, remoteIp?: string): Promise<void> {
    const { enabled, secretKey } = this.config.turnstile;

    if (!enabled) {
      this.logger.debug('Turnstile verification skipped — disabled by configuration.');
      return;
    }

    if (!token) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Please complete the verification challenge.',
        details: [{ field: 'turnstileToken', message: 'Missing.' }],
      });
    }

    const body = new URLSearchParams({ secret: secretKey, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    let result: TurnstileResponse;
    try {
      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(8_000),
      });
      result = (await response.json()) as TurnstileResponse;
    } catch (error) {
      /**
       * Cloudflare unreachable. This fails OPEN deliberately: the honeypot and
       * the per-IP rate limit are still in force, and blocking every genuine
       * enquiry during a third-party outage costs the client real business.
       * Spam that slips through in that window is an inbox annoyance.
       */
      this.logger.error(
        `Turnstile verification unreachable, allowing the request: ${(error as Error).message}`,
      );
      return;
    }

    if (!result.success) {
      this.logger.warn(
        `Turnstile rejected a submission: ${(result['error-codes'] ?? []).join(', ')}`,
      );
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Verification failed. Please try again.',
        details: [{ field: 'turnstileToken', message: 'Rejected.' }],
      });
    }
  }

  /**
   * Honeypot check.
   *
   * The field is named innocuously and hidden from sighted users; a real
   * visitor never fills it, a naive bot fills every input it finds. Rejecting
   * with a generic validation error rather than naming the honeypot keeps the
   * trap useful.
   */
  assertHoneypotEmpty(value: string | undefined): void {
    if (value && value.trim().length > 0) {
      this.logger.warn('Rejected a submission that filled the honeypot field.');
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Your submission could not be processed. Please try again.',
      });
    }
  }
}
