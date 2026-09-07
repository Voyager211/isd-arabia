import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';

/**
 * The OpenAPI document definition, in one place.
 *
 * Shared by the running app (which serves Swagger UI) and the generator script
 * that writes docs/openapi.json. Two definitions would drift, and the
 * committed spec is the one people read.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('ISD Arabia API')
    .setDescription(
      [
        'B2B industrial catalogue with a quotation-based enquiry flow.',
        '',
        '**There is no pricing, checkout or payment surface anywhere in this API.**',
        'Visitors assemble a cart client-side and submit it as a quotation request;',
        'the commercial conversation happens offline afterwards.',
        '',
        '### Response envelope',
        'Every response has the same shape:',
        '```json',
        '{ "success": true,  "data": {}, "meta": {} }',
        '{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [] } }',
        '```',
        '',
        '### Authentication',
        'Admin routes require a JWT delivered as an httpOnly cookie (`isd_at`),',
        'obtained from `POST /admin/auth/login`. Bearer tokens are accepted as a',
        'secondary source so this page and integration tests remain usable.',
        '',
        'Public catalogue and quotation routes need no authentication.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addCookieAuth('isd_at', { type: 'apiKey', in: 'cookie', name: 'isd_at' })
    .addBearerAuth()
    .addTag('Catalogue — categories', 'The three-level category tree and mega-menu')
    .addTag('Catalogue — brands')
    .addTag('Catalogue — industries')
    .addTag('Catalogue — products', 'Listing with facet counts, detail, and related')
    .addTag('Catalogue — search', 'Typeahead suggestions')
    .addTag('Quotations', 'Public quotation submission')
    .addTag('Catalogue download', 'Lead-gated catalogue PDF')
    .addTag('System', 'Liveness probe')
    .addTag('Admin — auth')
    .addTag('Admin — categories')
    .addTag('Admin — brands')
    .addTag('Admin — industries')
    .addTag('Admin — products')
    .addTag('Admin — quotations')
    .addTag('Admin — catalogue')
    .addTag('Admin — uploads', 'Signed direct-to-Cloudinary upload parameters')
    .addTag('Admin — dashboard')
    .build();

  return SwaggerModule.createDocument(app, config);
}

/** Where the interactive docs are served, relative to the API prefix. */
export const SWAGGER_PATH = 'docs';
