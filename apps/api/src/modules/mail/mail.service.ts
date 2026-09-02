import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import type { Quotation } from '../quotations/quotation.schema';
import { AppConfigService } from '@/config/config.service';

/**
 * Internal notification email (PROJECT_PLAN.md §18 #7).
 *
 * ONE email, to ONE internal address, when a quotation arrives. There are
 * deliberately no customer-facing emails on this platform: the on-screen
 * confirmation is the customer's only receipt, which is why that page has to
 * be complete and printable.
 *
 * Toggleable via `QUOTATION_NOTIFY_ENABLED` so staging does not send.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    const { host, port, user, password, enabled } = this.config.mail;

    if (!enabled) {
      this.logger.log('Quotation notifications are disabled by configuration.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      // 465 is implicit TLS; 587 upgrades via STARTTLS.
      secure: port === 465,
      auth: { user, pass: password },
    });
  }

  /**
   * Sends the internal notification. Never throws.
   *
   * A submission that reached the database is a successful submission. If the
   * SMTP relay is down, the customer must still see their quote number — the
   * record is safe and the team will see it in the admin table regardless.
   * Acceptance criterion #33 covers the happy path; this covers the rest.
   */
  async notifyNewQuotation(quotation: Quotation): Promise<void> {
    if (!this.transporter) return;

    const { from, notifyTo } = this.config.mail;
    const itemCount = quotation.items.reduce((total, item) => total + item.quantity, 0);

    try {
      await this.transporter.sendMail({
        from,
        to: notifyTo,
        // The quote number and company in the subject make the inbox scannable
        // without opening anything.
        subject: `New quotation ${quotation.quoteNumber} — ${quotation.customer.company}`,
        replyTo: quotation.customer.email,
        text: this.plainText(quotation, itemCount),
        html: this.html(quotation, itemCount),
      });

      this.logger.log(`Notified ${notifyTo} of quotation ${quotation.quoteNumber}`);
    } catch (error) {
      this.logger.error(
        `Failed to send the notification for ${quotation.quoteNumber}: ${(error as Error).message}. ` +
          'The quotation itself was saved and is visible in the admin.',
      );
    }
  }

  private plainText(quotation: Quotation, itemCount: number): string {
    const lines = quotation.items.map(
      (item) =>
        `  ${item.quantity} × ${item.name} (${item.sku})${item.note ? ` — ${item.note}` : ''}`,
    );

    return [
      `Quotation ${quotation.quoteNumber}`,
      '',
      `Company:   ${quotation.customer.company}`,
      `Contact:   ${quotation.customer.name}${quotation.customer.designation ? `, ${quotation.customer.designation}` : ''}`,
      `Email:     ${quotation.customer.email}`,
      `Phone:     ${quotation.customer.phone}`,
      '',
      'Delivery:',
      `  ${quotation.address.line1}`,
      ...(quotation.address.line2 ? [`  ${quotation.address.line2}`] : []),
      `  ${quotation.address.city}, ${quotation.address.region}`,
      `  ${quotation.address.country}`,
      '',
      `Items (${itemCount}):`,
      ...lines,
      ...(quotation.message ? ['', 'Message:', `  ${quotation.message}`] : []),
    ].join('\n');
  }

  private html(quotation: Quotation, itemCount: number): string {
    const rows = quotation.items
      .map(
        (item) => `
          <tr>
            <td style="padding:6px 12px 6px 0;border-bottom:1px solid #DCE0E8">${escapeHtml(item.name)}</td>
            <td style="padding:6px 12px 6px 0;border-bottom:1px solid #DCE0E8;font-family:monospace">${escapeHtml(item.sku)}</td>
            <td style="padding:6px 0;border-bottom:1px solid #DCE0E8;text-align:right">${item.quantity} ${escapeHtml(item.unit)}</td>
          </tr>`,
      )
      .join('');

    return `
      <div style="font-family:system-ui,sans-serif;color:#161B24;max-width:640px">
        <h1 style="font-size:20px;margin:0 0 4px">Quotation ${escapeHtml(quotation.quoteNumber)}</h1>
        <p style="margin:0 0 16px;color:#5A6474">${itemCount} item(s)</p>

        <h2 style="font-size:15px;margin:16px 0 4px">Customer</h2>
        <p style="margin:0;line-height:1.6">
          <strong>${escapeHtml(quotation.customer.company)}</strong><br>
          ${escapeHtml(quotation.customer.name)}${quotation.customer.designation ? `, ${escapeHtml(quotation.customer.designation)}` : ''}<br>
          <a href="mailto:${escapeHtml(quotation.customer.email)}">${escapeHtml(quotation.customer.email)}</a><br>
          <a href="tel:${escapeHtml(quotation.customer.phone)}">${escapeHtml(quotation.customer.phone)}</a>
        </p>

        <h2 style="font-size:15px;margin:16px 0 4px">Delivery address</h2>
        <p style="margin:0;line-height:1.6">
          ${escapeHtml(quotation.address.line1)}<br>
          ${quotation.address.line2 ? `${escapeHtml(quotation.address.line2)}<br>` : ''}
          ${escapeHtml(quotation.address.city)}, ${escapeHtml(quotation.address.region)}<br>
          ${escapeHtml(quotation.address.country)}
        </p>

        <h2 style="font-size:15px;margin:16px 0 4px">Items</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>

        ${
          quotation.message
            ? `<h2 style="font-size:15px;margin:16px 0 4px">Message</h2>
               <p style="margin:0;white-space:pre-wrap">${escapeHtml(quotation.message)}</p>`
            : ''
        }
      </div>`;
  }
}

/**
 * Customer-supplied text goes into an HTML email, so it is escaped. A company
 * name containing a stray `<` would otherwise break the layout at best.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
