import { describe, expect, it } from 'vitest';

import { catalogueLeadSchema, quoteRequestSchema } from './quote-request.schema';

/**
 * PROJECT_PLAN.md §15.4 calls for tests on the quotation form validation.
 *
 * This schema is the gate between a visitor and a submitted enquiry. Every
 * rule here is one the client would otherwise have to chase by phone — a
 * missing phone number on a quotation is a lost afternoon.
 */

const valid = {
  name: 'Faisal Al-Otaibi',
  designation: 'Procurement Manager',
  company: 'Gulf Fabrication Co.',
  email: 'faisal@contractor.example',
  phone: '+966500000000',
  line1: 'Plot 42, Second Industrial City',
  city: 'Dammam',
  region: 'Eastern Province',
  message: 'Please confirm lead time.',
  consent: true as const,
};

/** Returns the message reported against one field, if any. */
function errorFor(input: Record<string, unknown>, path: string): string | undefined {
  const result = quoteRequestSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === path)?.message;
}

describe('quoteRequestSchema', () => {
  it('accepts a complete request', () => {
    expect(quoteRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a request with only the required fields', () => {
    const { designation, message, ...required } = valid;
    void designation;
    void message;

    expect(quoteRequestSchema.safeParse(required).success).toBe(true);
  });

  describe('customer details', () => {
    it('requires a usable name', () => {
      expect(errorFor({ ...valid, name: '' }, 'name')).toBe('Enter your full name.');
      expect(errorFor({ ...valid, name: 'A' }, 'name')).toBe('Enter your full name.');
    });

    it('requires a company', () => {
      // The single most important field on the form: this is a B2B platform
      // and pricing is quoted per company.
      expect(errorFor({ ...valid, company: '' }, 'company')).toBe('Enter your company name.');
    });

    it('rejects a malformed email', () => {
      expect(errorFor({ ...valid, email: 'not-an-email' }, 'email')).toBe(
        'Enter a valid email address.',
      );
      expect(errorFor({ ...valid, email: 'faisal@' }, 'email')).toBeDefined();
    });

    it('distinguishes an empty email from an invalid one', () => {
      // Two different mistakes deserve two different messages.
      expect(errorFor({ ...valid, email: '' }, 'email')).toBe('Enter your work email.');
    });

    it('requires a phone number long enough to be real', () => {
      expect(errorFor({ ...valid, phone: '123' }, 'phone')).toBe('Enter a contact phone number.');
    });

    it('accepts international and local phone formats alike', () => {
      // No format regex on purpose: a buyer typing '013 800 1234' or
      // '+966 50 000 0000' should not be argued with.
      for (const phone of ['+966500000000', '+966 50 000 0000', '013 800 1234', '0138001234']) {
        expect(quoteRequestSchema.safeParse({ ...valid, phone }).success).toBe(true);
      }
    });

    it('treats the job title as optional', () => {
      const { designation, ...withoutTitle } = valid;
      void designation;
      expect(quoteRequestSchema.safeParse(withoutTitle).success).toBe(true);
    });
  });

  describe('delivery address', () => {
    it('requires the first line and a city', () => {
      expect(errorFor({ ...valid, line1: '' }, 'line1')).toBe('Enter the delivery address.');
      expect(errorFor({ ...valid, city: '' }, 'city')).toBe('Enter a city.');
    });

    it('accepts every Saudi province', () => {
      for (const region of ['Riyadh', 'Makkah', 'Eastern Province', 'Qassim', 'Jazan', 'Al Jawf']) {
        expect(quoteRequestSchema.safeParse({ ...valid, region }).success).toBe(true);
      }
    });

    it('rejects a region outside the delivery area', () => {
      // Deliveries are Kingdom-wide only; a free-text region would let an
      // enquiry through that cannot be fulfilled.
      expect(errorFor({ ...valid, region: 'Greater London' }, 'region')).toBe('Choose a region.');
    });

    it('treats line 2 and the postal code as optional', () => {
      expect(quoteRequestSchema.safeParse({ ...valid, line2: undefined }).success).toBe(true);
      expect(quoteRequestSchema.safeParse({ ...valid, postalCode: undefined }).success).toBe(true);
    });
  });

  describe('consent', () => {
    it('requires the box to be ticked', () => {
      // `literal(true)`, not `boolean()` — an unticked box is `false`, which a
      // plain boolean would accept.
      expect(errorFor({ ...valid, consent: false }, 'consent')).toBe(
        'Please confirm we may contact you.',
      );
      expect(errorFor({ ...valid, consent: undefined }, 'consent')).toBeDefined();
    });
  });

  describe('honeypot', () => {
    it('accepts an empty or absent honeypot', () => {
      expect(quoteRequestSchema.safeParse({ ...valid, website: '' }).success).toBe(true);
      expect(quoteRequestSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects a filled honeypot', () => {
      expect(
        quoteRequestSchema.safeParse({ ...valid, website: 'http://spam.example' }).success,
      ).toBe(false);
    });
  });

  describe('length ceilings', () => {
    it('rejects a message beyond the server limit', () => {
      // Mirrors @MaxLength(4000) on the DTO. Catching it here means the
      // visitor sees it inline instead of losing the request to a 400.
      expect(quoteRequestSchema.safeParse({ ...valid, message: 'x'.repeat(4001) }).success).toBe(
        false,
      );
      expect(quoteRequestSchema.safeParse({ ...valid, message: 'x'.repeat(4000) }).success).toBe(
        true,
      );
    });

    it('rejects an over-long company name', () => {
      expect(quoteRequestSchema.safeParse({ ...valid, company: 'x'.repeat(161) }).success).toBe(
        false,
      );
    });
  });

  it('reports every problem at once rather than one at a time', () => {
    // A form that surfaces one error per submit is a form people abandon.
    const result = quoteRequestSchema.safeParse({
      name: '',
      company: '',
      email: 'nope',
      phone: '1',
      line1: '',
      city: '',
      region: 'Nowhere',
      consent: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(7);
    }
  });
});

describe('catalogueLeadSchema', () => {
  const lead = {
    name: 'Faisal Al-Otaibi',
    company: 'Gulf Fabrication Co.',
    email: 'faisal@contractor.example',
    phone: '+966500000000',
    consent: true as const,
  };

  it('accepts a complete lead', () => {
    expect(catalogueLeadSchema.safeParse(lead).success).toBe(true);
  });

  it('requires all four fields and consent', () => {
    for (const field of ['name', 'company', 'email', 'phone'] as const) {
      expect(catalogueLeadSchema.safeParse({ ...lead, [field]: '' }).success).toBe(false);
    }
    expect(catalogueLeadSchema.safeParse({ ...lead, consent: false }).success).toBe(false);
  });

  it('rejects a filled honeypot', () => {
    expect(catalogueLeadSchema.safeParse({ ...lead, website: 'spam' }).success).toBe(false);
  });

  it('asks for nothing beyond the five fields', () => {
    // A deliberate constraint, asserted so it cannot creep. Every extra field
    // on a download gate measurably costs completions.
    expect(Object.keys(catalogueLeadSchema.shape).sort()).toEqual([
      'company',
      'consent',
      'email',
      'name',
      'phone',
      'website',
    ]);
  });
});
