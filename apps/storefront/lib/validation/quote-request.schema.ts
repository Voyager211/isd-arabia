import { z } from 'zod';

import { SAUDI_REGIONS } from '@isd/shared-types';

/**
 * Quotation request validation (PROJECT_PLAN.md §9.9, §15.4).
 *
 * Mirrors the server DTO field for field. The server stays the authority —
 * this only saves a round trip and produces inline errors. When the DTO in
 * `apps/api/src/modules/quotations/dto/submit-quotation.dto.ts` changes, this
 * changes with it, and the tests here are what catch the drift.
 *
 * Extracted from the form component so it can be tested without rendering
 * anything: this is the gate between a visitor and a submitted enquiry, and
 * every rule in it is one the client would otherwise have to chase by phone.
 */
export const quoteRequestSchema = z.object({
  // Matches SubmitQuotationCustomerDto.
  name: z.string().min(2, 'Enter your full name.').max(120),
  designation: z.string().max(120).optional(),
  company: z.string().min(2, 'Enter your company name.').max(160),
  email: z.string().min(1, 'Enter your work email.').email('Enter a valid email address.'),
  phone: z.string().min(6, 'Enter a contact phone number.').max(40),

  // Matches SubmitQuotationAddressDto.
  line1: z.string().min(3, 'Enter the delivery address.').max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2, 'Enter a city.').max(120),
  /** Constrained to the thirteen Saudi provinces — the only delivery area. */
  region: z.enum(SAUDI_REGIONS, { message: 'Choose a region.' }),
  postalCode: z.string().max(20).optional(),

  message: z.string().max(4000).optional(),

  /**
   * `literal(true)` rather than `boolean()`: an unticked box is `false`, which
   * a plain boolean would happily accept.
   *
   * The message goes through `errorMap`, not `message`. `z.literal`'s second
   * argument is RawCreateParams, which has no `message` key — passing one
   * there is silently ignored and the customer is shown Zod's internal
   * "Invalid literal value, expected true".
   */
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Please confirm we may contact you.' }),
  }),

  /**
   * Honeypot. Hidden from sighted users and out of the tab order, so a real
   * visitor never fills it. Capped at zero length rather than checked on the
   * client — the server is what actually rejects the submission.
   */
  website: z.string().max(0).optional(),
});

export type QuoteRequestValues = z.input<typeof quoteRequestSchema>;

/**
 * Catalogue download lead form (§9.7).
 *
 * Four fields and a consent box. Every extra field on a gate like this
 * measurably costs completions, and the sales team can ask the rest once they
 * are talking.
 */
export const catalogueLeadSchema = z.object({
  name: z.string().min(2, 'Enter your full name.').max(120),
  company: z.string().min(2, 'Enter your company name.').max(160),
  email: z.string().min(1, 'Enter your work email.').email('Enter a valid email address.'),
  phone: z.string().min(6, 'Enter a contact phone number.').max(40),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Please confirm we may contact you.' }),
  }),
  website: z.string().max(0).optional(),
});

export type CatalogueLeadValues = z.input<typeof catalogueLeadSchema>;
