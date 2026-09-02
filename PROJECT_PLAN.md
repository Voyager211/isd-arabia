# Project Requirements — B2B Industrial Catalogue & Quotation Platform

**Version:** 2.0 **Date:** 31 August 2026 **Prepared by:** HOX Infotech **Status:** Approved for build

---

## 1. Overview

### 1.1 What we are building

A single-vendor B2B industrial products catalogue with a **quotation-based enquiry flow** instead of transactional checkout. Visitors browse a deep product catalogue, add items to a cart, and submit the cart as a quotation request with their contact and delivery details. An admin team manages the catalogue and works through incoming quotations from one shared page.

This is deliberately **not** a transactional e-commerce site. There is no pricing shown publicly, no payment gateway, no customer accounts, and no order fulfilment. The commercial conversation happens offline after the quotation lands.

### 1.2 Why this shape

Industrial B2B suppliers in this segment price per-customer based on volume, contract terms, and account history. Publishing fixed prices is commercially undesirable. Every reference site in this space uses the same pattern: full catalogue visibility, price on request. We are matching that motion, not inventing one.

### 1.3 Reference sites

| Site                   | What we take from it                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `kasweld.sa`           | Layout, information architecture, navigation pattern, catalogue depth, product line and category taxonomy |
| `primearabiagroup.com` | Colour theme and overall visual tone                                                                      |

**Important:** These are references for _structure and direction_, not assets to copy. We build our own components, our own markup, our own type scale. No images, icons, copy, or CSS are taken from either site.

---

## 2. Scope

Single-delivery project. There is no phase 2. Everything listed as in-scope ships in this engagement; everything listed as excluded is not built and is not planned.

### 2.1 In scope

**Storefront (public, no login)**

- Home page
- Category listing with faceted filtering
- Product detail pages
- Brand and industry landing pages
- Search with typeahead
- Quotation cart (client-side)
- Quotation submission form and confirmation
- Catalogue PDF download with lead capture
- Static pages (About, Contact)
- SEO layer: server-rendered metadata, sitemap, structured data

**Admin (JWT protected)**

- Login with forced first-use password change
- Dashboard
- Categories: add / edit / delete, nested tree
- Brands: add / edit / delete
- Industries: add / edit / delete
- Products: add / edit / delete, multi-image upload
- Quotations: single shared table, detail modal, status management
- Catalogue files: upload and manage the downloadable PDF
- Catalogue download leads: table view and export

**Backend**

- NestJS REST API
- MongoDB via Mongoose
- Cloudinary image and PDF pipeline
- JWT admin auth
- Internal email notification on new quotation
- On-demand revalidation trigger to the storefront

### 2.2 Explicitly excluded

Not built, not scaffolded, not designed for.

- Customer accounts, login, or registration
- Payment gateway of any kind
- Pricing display, price lists, or per-customer pricing
- Order management, shipping, or fulfilment
- Stock levels or inventory ledger
- Blog or CMS article system
- Arabic language or RTL layout (see §18)
- ZATCA e-invoicing
- Multi-vendor anything
- Mobile app
- Bulk product import from spreadsheet or existing system — all catalogue data is entered through the admin UI
- Customer-facing quotation confirmation emails
- URL redirect map from a prior site

---

## 3. Technology stack

### 3.1 Storefront

| Concern       | Choice                                                   | Notes                                           |
| ------------- | -------------------------------------------------------- | ----------------------------------------------- |
| Framework     | **Next.js 15, App Router**                               | Server rendering for the SEO-critical catalogue |
| Language      | TypeScript (strict)                                      |                                                 |
| Styling       | Tailwind CSS v4                                          | Design tokens as CSS variables                  |
| State         | Context API + `useReducer`                               | Cart and UI only, in client components          |
| HTTP          | `fetch` in server components, Axios in client components |                                                 |
| Forms         | React Hook Form + Zod                                    | Zod schemas mirror the backend DTOs             |
| Icons         | Lucide React                                             |                                                 |
| Notifications | Sonner                                                   |                                                 |
| Hosting       | Vercel                                                   |                                                 |

### 3.2 Admin

| Concern   | Choice                       | Notes                                                   |
| --------- | ---------------------------- | ------------------------------------------------------- |
| Framework | **React 19 + Vite**          | SPA. No SEO requirement, so SSR would be pure overhead. |
| Language  | TypeScript (strict)          |                                                         |
| Styling   | Tailwind CSS v4              | Same token package as the storefront                    |
| State     | Context API + `useReducer`   | Auth and UI                                             |
| Routing   | React Router v7              |                                                         |
| HTTP      | Axios with a shared instance | Interceptors for auth refresh and error normalisation   |
| Forms     | React Hook Form + Zod        |                                                         |
| Rich text | TipTap                       | Product descriptions and industry content               |
| Hosting   | Vercel, separate project     |                                                         |

**Why two different frameworks:** the storefront needs server rendering for organic search. The admin sits behind a login and will never be crawled — putting it on Next.js adds build complexity, server-component boundary rules, and deployment surface for zero benefit. Two small focused apps beat one app carrying requirements it does not have.

### 3.3 Backend

| Concern     | Choice                                                       | Notes                                      |
| ----------- | ------------------------------------------------------------ | ------------------------------------------ |
| Framework   | NestJS 11                                                    | Three-layer: controller → service → model  |
| Language    | TypeScript (strict)                                          |                                            |
| Database    | MongoDB Atlas M0 (free tier)                                 |                                            |
| ODM         | Mongoose 8                                                   | Typed schemas                              |
| Validation  | `class-validator` + `class-transformer` on DTOs, Zod for env | Global `ValidationPipe`, `whitelist: true` |
| Auth        | `@nestjs/jwt` + Passport JWT strategy                        | Admin only                                 |
| File upload | Signed direct-to-Cloudinary, Multer memory fallback          | Never write to local disk                  |
| Email       | Nodemailer + Brevo free tier                                 | Internal notification only                 |
| Docs        | Swagger via `@nestjs/swagger`                                | Disabled in production                     |
| Logging     | Pino (`nestjs-pino`)                                         |                                            |

### 3.4 Infrastructure

| Concern            | Choice                         | Constraints to respect                              |
| ------------------ | ------------------------------ | --------------------------------------------------- |
| Database           | MongoDB Atlas M0               | 512 MB storage, 500 connections, shared CPU         |
| Images and PDFs    | Cloudinary Free                | 25 monthly credits (~25 GB storage or bandwidth)    |
| Storefront hosting | Vercel                         |                                                     |
| Admin hosting      | Vercel, separate project       |                                                     |
| API hosting        | Render free tier + UptimeRobot | See §14.2 for the free-tier hours budget            |
| Domain + DNS       | Client-owned account           | Per HOX standard: infra registered in client's name |

---

## 4. Next.js rendering strategy

Replaces the prerender approach from v1.0. Largest architectural change in this revision — read before Phase 1 starts.

### 4.1 Rendering mode by route

| Route                           | Mode                                           | Revalidation          |
| ------------------------------- | ---------------------------------------------- | --------------------- |
| `/`                             | ISR                                            | 1 hour + on-demand    |
| `/products`                     | ISR                                            | 1 hour + on-demand    |
| `/category/[slug]`              | ISR, `generateStaticParams` for levels 0 and 1 | 1 hour + on-demand    |
| `/products/[slug]`              | ISR                                            | 24 hours + on-demand  |
| `/brands`, `/brands/[slug]`     | ISR                                            | 1 hour + on-demand    |
| `/industries/[slug]`            | ISR                                            | 24 hours + on-demand  |
| `/search`                       | Dynamic (`force-dynamic`)                      | Not cached            |
| `/quote-cart`, `/quote-request` | Client-rendered                                | Not cached, `noindex` |
| `/about`, `/contact`            | Static                                         | On-demand only        |

Filtered listing views (`?brand=`, `?industry=`, `?sort=`) render dynamically. Only the clean canonical category URL is statically generated — that is the one search engines index.

### 4.2 On-demand revalidation

When an admin saves a product, category, brand, or industry, the NestJS API calls a Next.js route handler to purge the affected cache tags immediately. Without this, an admin edits a product and does not see it live for an hour, which reads as a bug and generates support noise.

```
POST /api/revalidate
Header: x-revalidate-secret: <REVALIDATE_SECRET>
Body:   { "tags": ["product:tig-torch-wp-26", "category:tig-welding", "products:list"] }
```

The handler calls `revalidateTag()` for each tag and returns `200`. Requests with a missing or wrong secret get `401` and are logged.

Tag every server-side fetch:

```ts
fetch(`${API}/products/${slug}`, {
  next: { tags: [`product:${slug}`, 'products:list'], revalidate: 86400 },
});
```

The NestJS service layer emits the revalidation call after a successful write, fire-and-forget with a logged failure. A failed revalidation must never fail the admin's save.

### 4.3 Server and client component boundaries

- **Server components by default.** Pages, layouts, product grids, spec tables, and footers all fetch directly from the NestJS API on the server.
- **Client components only where interactivity demands it:** cart provider and drawer, add-to-quote button, quantity stepper, mega-menu, search typeahead, filter sidebar, image gallery, quote request form, catalogue download modal.
- Mark them `'use client'` at the leaf, not at the layout. Wrapping the root layout in a client component discards server rendering for the entire tree and defeats the reason we chose Next.js.
- `CartProvider` is a client component mounted in the root layout. It wraps `{children}` but does not force children to be client components — children passed as props stay server-rendered.

### 4.4 Environment separation

The NestJS API base URL is needed on both server and client:

- `API_INTERNAL_URL` — server-side fetches, may be a private URL
- `NEXT_PUBLIC_API_URL` — client-side fetches from the browser

Never expose secrets through `NEXT_PUBLIC_`.

---

## 5. Design system

### 5.1 Colour — Prime Arabia direction

> **BEFORE PHASE 1:** Sample the computed styles from `primearabiagroup.com` for the header, primary CTA, and footer, and replace the four brand primitives below. Everything else derives from them, so this is a five-minute change that re-themes the whole app. Confirmed as an action item.

Token-based. Components reference semantic tokens only; semantic tokens reference primitives. Never hardcode a hex in a component.

```css
/* tokens.css — primitives (SWAP AFTER SAMPLING) */
:root {
  --brand-deep: #0b2545; /* deep industrial navy — headers, footer */
  --brand-primary: #1b4b8f; /* primary blue — links, active states */
  --brand-accent: #e8760c; /* warm signal orange — CTAs, quote actions */
  --brand-accent-dk: #c25e05; /* accent hover/pressed */

  --n-000: #ffffff;
  --n-050: #f7f8fa;
  --n-100: #edeff3;
  --n-200: #dce0e8;
  --n-400: #9aa3b2;
  --n-600: #5a6474;
  --n-800: #2a3140;
  --n-900: #161b24;

  --status-new: #2563eb;
  --status-review: #d97706;
  --status-quoted: #7c3aed;
  --status-won: #059669;
  --status-lost: #dc2626;
}
```

**Semantic layer**

| Token                | Value             | Used for                                               |
| -------------------- | ----------------- | ------------------------------------------------------ |
| `--surface-page`     | `--n-000`         | Page background                                        |
| `--surface-raised`   | `--n-050`         | Cards, sidebar panels                                  |
| `--surface-inverse`  | `--brand-deep`    | Header bar, footer                                     |
| `--text-primary`     | `--n-900`         | Body copy                                              |
| `--text-secondary`   | `--n-600`         | Meta, captions                                         |
| `--text-on-inverse`  | `--n-000`         | Text on dark surfaces                                  |
| `--border-subtle`    | `--n-200`         | Card and input borders                                 |
| `--action-primary`   | `--brand-accent`  | "Add to quote", "Submit request", "Download catalogue" |
| `--action-secondary` | `--brand-primary` | Secondary buttons, links                               |

**Accent discipline:** the orange accent is reserved for quote-related actions and the catalogue download. It is the loudest thing on the page and must always mean "this moves you toward a commercial conversation." Not for decoration, dividers, or generic emphasis.

The token file lives in `packages/design-tokens` and is imported by both frontends so they cannot drift.

### 5.2 Typography

| Role               | Family               | Weights       | Notes                                                                                   |
| ------------------ | -------------------- | ------------- | --------------------------------------------------------------------------------------- |
| Display / headings | **Barlow Condensed** | 600, 700      | Condensed industrial sans. Long product names fit a card in two lines instead of three. |
| Body / UI / data   | **Inter**            | 400, 500, 600 | Strong at small sizes, tabular figures for spec and admin tables.                       |

Load via `next/font/google` on the storefront (self-hosted, zero layout shift) and a standard link with `display: swap` on the admin.

`font-variant-numeric: tabular-nums` on all admin tables, spec tables, and quantity fields.

**Type scale** (1.25 major third, 16px base):

```
display   40 / 44   Barlow Condensed 700
h1        32 / 38   Barlow Condensed 700
h2        26 / 32   Barlow Condensed 600
h3        20 / 26   Barlow Condensed 600
body-lg   18 / 28   Inter 400
body      16 / 26   Inter 400
body-sm   14 / 22   Inter 400
caption   13 / 18   Inter 500
```

Body copy capped at 72 characters (`max-w-[68ch]`). Product descriptions are dense technical prose; long measures make them unreadable.

**Avoid:** all-caps micro-labels above every heading, single-word colour accents inside headlines, `→` glyphs appended to button text. These read as template chrome.

### 5.3 Layout

- Container `max-w-[1320px]`, gutters `px-4 md:px-6 lg:px-8`
- 12-column grid, `gap-6`
- Spacing scale 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
- Radius: `4px` inputs and buttons, `6px` cards, `0` on the header bar and full-bleed sections. Hierarchy comes partly from not giving everything the same radius.
- Elevation: two levels only. `shadow-sm` resting cards, `shadow-lg` modals and dropdowns. Nothing else gets a shadow.

**Breakpoints:** `sm 640` / `md 768` / `lg 1024` / `xl 1280`. Mega-menu becomes an off-canvas drawer below `lg`. Filter sidebar becomes a bottom sheet below `lg`.

### 5.4 Motion

One orchestrated moment on the home page hero. Everything else responds to an action: drawer slide, modal fade, accordion expand, toast enter. No scroll-triggered fade-and-slide on every section.

All motion respects `prefers-reduced-motion: reduce`.

### 5.5 Accessibility floor

- WCAG 2.1 AA contrast on all text and interactive elements
- Visible keyboard focus ring on every interactive element; never `outline: none` without a replacement
- Mega-menu keyboard navigable with arrow keys, `Escape` closes
- Modals trap focus and restore it on close
- All images carry meaningful `alt`; admin image upload requires alt text
- Real `<label>` elements; errors announced via `aria-live`

---

## 6. Information architecture

### 6.1 Catalogue taxonomy

Three-level tree, seeded from the Kasweld product line structure. Seeded by script at setup; the admin manages it through the UI thereafter.

```
WELDING
├─ Consumables
│  ├─ Fire Blankets
│  ├─ Welding Helmets & Masks
│  ├─ Fibre Glass Tapes
│  ├─ Purging Paper
│  ├─ Chipping Hammers
│  ├─ Welding Curtains
│  └─ Electrode Ovens
├─ TIG Welding
│  ├─ TIG Torches & Kits
│  ├─ Ceramic Nozzles
│  └─ Tungsten Electrodes
├─ MIG Welding
│  ├─ Contact Tips
│  └─ Jerrycans
├─ Arc Welding
│  ├─ Welding Holders
│  ├─ Grounding Clamps
│  ├─ Welding Rods
│  ├─ Cable Adapters
│  ├─ Wrap Around
│  └─ Cable Connectors
└─ Gas Welding & Cutting
   ├─ Welding Regulators
   ├─ Welding Electrodes
   ├─ Welding Nozzles
   ├─ Heating Nozzles
   ├─ Twin Hoses
   ├─ Torch Accessories
   └─ Cylinder Trolleys

TOOLS & EQUIPMENT
├─ Safety
│  ├─ Finger Guards
│  ├─ Tool Lanyards
│  ├─ Safety Gloves
│  ├─ Aprons & Sleeves
│  ├─ Face Shields & Headgear
│  ├─ Safety Padlocks
│  ├─ Face Masks
│  ├─ Suspension Trauma Straps
│  └─ Safety Harnesses
├─ Scaffolding Tools
│  ├─ Scaffolding Buckets
│  ├─ Scaffolding Bags
│  ├─ Scaffolding Spanners
│  ├─ Scaffolding Belts
│  ├─ Aramco Scaff Tags
│  ├─ Aramco Tag Holders
│  └─ Flame Resistant Face Hoods
├─ Wire Brushes
│  ├─ Cup Brushes
│  ├─ Wheel Brushes
│  ├─ End Brushes
│  ├─ 4-Row Wire Brushes
│  ├─ Non-Sparking Shovels
│  └─ Hose Repair Kits
└─ Tooling & Cutting
   ├─ Magnetic Cutters
   ├─ Pilot Pins
   ├─ Carbide Burrs
   ├─ Diamond Cutting Discs
   ├─ Diamond Grinding Discs
   ├─ Stainless Steel Files
   ├─ Cutting & Grinding Discs
   └─ Flap Wheels & Discs
```

**Additional flat categories** for the filter sidebar, not in the mega-menu: Chemicals, Measurement Tools, Non-Sparking Tools, Adhesives, Abrasives, Hardware, Metal Markers, Hand Tools.

### 6.2 Brands (seed data)

KASWELD · KASWELD PREMIUM · KASPRO · KASPRO PREMIUM · MARKAL · ESAB · AQUASOL · EMTEK · MOLYKOTE · STERWISE

### 6.3 Industries (seed data)

Steel Construction · Manufacturing · Pipelines · Ship Building · Railway · Oil & Gas · Petrochemical · Repair & Maintenance · Power Generation

### 6.4 URL structure

| Route            | Example                                                   |
| ---------------- | --------------------------------------------------------- |
| Home             | `/`                                                       |
| Category         | `/category/[slug]` → `/category/tig-torches-and-kits`     |
| All products     | `/products`                                               |
| Product detail   | `/products/[slug]` → `/products/tig-torch-wp-26-flexible` |
| Brand index      | `/brands`                                                 |
| Brand            | `/brands/[slug]` → `/brands/kaspro`                       |
| Industry         | `/industries/[slug]`                                      |
| Search           | `/search?q=...`                                           |
| Quotation cart   | `/quote-cart`                                             |
| Submit quotation | `/quote-request`                                          |
| Confirmation     | `/quote-request/success/[quoteNumber]`                    |
| About            | `/about`                                                  |
| Contact          | `/contact`                                                |

Admin is a separate deployment at `admin.<domain>`.

---

## 7. Data models

Mongoose throughout. Common conventions:

- Default MongoDB `ObjectId` for `_id`
- `timestamps: true` on every schema
- Soft delete via `isDeleted: Boolean` + `deletedAt: Date`; all public queries filter `isDeleted: false`
- `slug` unique, indexed, generated from name, editable by admin
- `seo` sub-document on every publicly addressable entity

### 7.1 Shared sub-schemas

```ts
// SEO metadata — embedded, not a collection
{
  metaTitle:       String,   // max 60
  metaDescription: String,   // max 160
  metaKeywords:   [String],
  ogImage:         String,   // Cloudinary URL
}

// Cloudinary asset reference
{
  url:      String,  // required, secure_url
  publicId: String,  // required, needed for deletion
  alt:      String,  // required for images
  width:    Number,
  height:   Number,
  order:    Number,  // default 0
}
```

### 7.2 `Category`

```ts
{
  name:         String,    // required
  slug:         String,    // required, unique, indexed
  description:  String,
  image:        AssetRef,           // category tile
  banner:       AssetRef,           // listing page banner
  parent:       ObjectId | null,    // ref: Category, indexed
  ancestors:   [ObjectId],          // denormalised path, indexed
  level:        Number,             // 0, 1, or 2 — derived, not user-set
  displayOrder: Number,             // default 0
  showInMenu:   Boolean,            // default true
  isActive:     Boolean,            // default true
  seo:          SeoMeta,
  isDeleted:    Boolean,
  deletedAt:    Date,
}
```

**Indexes:** `{ slug: 1 }` unique · `{ parent: 1, displayOrder: 1 }` · `{ ancestors: 1 }` · `{ isActive: 1, isDeleted: 1 }`

**Rules:**

- Max depth 3 (level 0–2). Reject deeper nesting in the service layer.
- `ancestors` and `level` maintained by the service on create and on parent change. When a parent changes, rebuild `ancestors` for all descendants in a single `bulkWrite`.
- A category with children or products cannot be deleted. Return `409 Conflict` naming the blocker.

### 7.3 `Brand`

```ts
{
  name:         String,   // required
  slug:         String,   // required, unique, indexed
  logo:         AssetRef,
  banner:       AssetRef,
  description:  String,
  displayOrder: Number,
  isActive:     Boolean,
  seo:          SeoMeta,
  isDeleted:    Boolean,
  deletedAt:    Date,
}
```

### 7.4 `Industry`

```ts
{
  name:         String,
  slug:         String,   // unique, indexed
  icon:         AssetRef,
  banner:       AssetRef,
  description:  String,
  content:      String,   // long-form sanitised HTML
  displayOrder: Number,
  isActive:     Boolean,
  seo:          SeoMeta,
  isDeleted:    Boolean,
  deletedAt:    Date,
}
```

### 7.5 `Product`

```ts
{
  name:             String,     // required
  slug:             String,     // required, unique, indexed
  sku:              String,     // required, unique, indexed
  shortDescription: String,     // max 300, cards and meta fallback
  description:      String,     // sanitised rich text HTML
  keyFeatures:     [String],
  specifications:  [{ label: String, value: String }],

  images:          [AssetRef],  // order 0 is primary
  documents:       [{ name: String, url: String, publicId: String }],

  category:         ObjectId,   // ref: Category — LEAF only, required
  categoryPath:    [ObjectId],  // = category.ancestors + category._id
  brand:            ObjectId,   // ref: Brand, optional
  industries:      [ObjectId],  // ref: Industry

  unit:             String,     // "piece", "roll", "box", "metre"
  minOrderQuantity: Number,     // default 1
  availability:     String,     // in_stock | made_to_order | on_request

  isActive:         Boolean,
  isFeatured:       Boolean,
  isNewArrival:     Boolean,
  displayOrder:     Number,

  seo:              SeoMeta,
  isDeleted:        Boolean,
  deletedAt:        Date,
}
```

**Indexes:**

- `{ slug: 1 }` unique
- `{ sku: 1 }` unique
- `{ categoryPath: 1, isActive: 1, isDeleted: 1 }` — the main listing query
- `{ brand: 1, isActive: 1, isDeleted: 1 }`
- `{ industries: 1, isActive: 1, isDeleted: 1 }`
- `{ isFeatured: 1 }`, `{ isNewArrival: 1 }`
- Text index `{ name: 'text', sku: 'text', shortDescription: 'text' }`, weights `{ name: 10, sku: 8, shortDescription: 2 }`

**No price field.** Deliberate. Do not add one "just in case" — an unused price field on a quote-only site eventually leaks into a response or a template.

**On `categoryPath`:** this denormalisation turns "everything under Welding" into a single indexed query instead of a recursive lookup. Recompute it when a product's category changes _and_ when that category's own ancestors change. Cover both paths.

### 7.6 `Quotation`

```ts
{
  quoteNumber: String,   // required, unique — QT-2026-0001

  customer: {
    name:        String,  // required
    email:       String,  // required, validated
    phone:       String,  // required
    company:     String,  // required
    designation: String,
  },

  address: {
    line1:      String,   // required
    line2:      String,
    city:       String,   // required
    region:     String,   // required — Saudi province
    postalCode: String,
    country:    String,   // default "Saudi Arabia"
  },

  items: [{
    product:  ObjectId,   // ref: Product — may later be deleted
    name:     String,     // SNAPSHOT at submission
    sku:      String,     // SNAPSHOT
    imageUrl: String,     // SNAPSHOT
    unit:     String,     // SNAPSHOT
    quantity: Number,     // required, min 1
    note:     String,
  }],

  message: String,

  status: String,         // new | in_review | quoted | won | lost | cancelled
                          // default 'new'

  statusHistory: [{
    from: String, to: String,
    changedBy: ObjectId,  // ref: AdminUser
    note: String, changedAt: Date,
  }],

  adminNotes: [{
    note: String,
    addedBy: ObjectId,    // ref: AdminUser
    addedAt: Date,
  }],

  meta: { userAgent: String, ipAddress: String, referrer: String },

  isDeleted: Boolean,
  deletedAt: Date,
}
```

**Indexes:** `{ quoteNumber: 1 }` unique · `{ status: 1, createdAt: -1 }` · `{ 'customer.email': 1 }` · `{ createdAt: -1 }`

**Snapshotting is mandatory.** Line items copy `name`, `sku`, `imageUrl`, and `unit`. A quotation from six months ago must render exactly as submitted even after the product is renamed or deleted. Do not rely on `populate` for historical display.

**Quote number generation:** use the `Counter` collection with `findOneAndUpdate({ _id: 'quotation-2026' }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })`. Atomic. Do not use `countDocuments() + 1` — it races under concurrent submissions and produces duplicates.

### 7.7 `CatalogueFile`

New in v2.0. Backs the catalogue PDF download.

```ts
{
  title:       String,    // "2026 Product Catalogue"
  description: String,
  file: {
    url:       String,    // Cloudinary raw resource secure_url
    publicId:  String,
    sizeBytes: Number,
    pageCount: Number,    // optional, informational
  },
  coverImage:    AssetRef, // thumbnail on the download card
  version:       String,   // "v3", "2026-Q1"
  requiresLead:  Boolean,  // default true — gate behind the lead form
  downloadCount: Number,   // default 0
  isActive:      Boolean,  // only one active file at a time
  displayOrder:  Number,
  isDeleted:     Boolean,
  deletedAt:     Date,
}
```

**Rule:** exactly one `CatalogueFile` may have `isActive: true`. Activating one deactivates the others in the same operation.

### 7.8 `CatalogueLead`

```ts
{
  name:      String,   // required
  email:     String,   // required, validated
  phone:     String,   // required
  company:   String,   // required
  catalogue: ObjectId, // ref: CatalogueFile
  meta:      { userAgent: String, ipAddress: String, referrer: String },
  isDeleted: Boolean,
  deletedAt: Date,
}
```

**Indexes:** `{ createdAt: -1 }` · `{ email: 1 }`

### 7.9 `AdminUser`

```ts
{
  name:               String,   // required
  email:              String,   // required, unique, lowercase, indexed
  passwordHash:       String,   // required, bcrypt cost 12, select: false
  role:               String,   // super_admin | admin, default 'admin'
  isActive:           Boolean,  // default true
  mustChangePassword: Boolean,  // default false
  lastLoginAt:        Date,
  refreshTokenHash:   String,   // select: false
}
```

`passwordHash` and `refreshTokenHash` must carry `select: false` so they cannot leak through a careless `findOne()` that gets serialised into a response.

No public registration endpoint. See §12.1 for seeding.

### 7.10 `Counter`

```ts
{ _id: String, seq: Number }   // e.g. { _id: "quotation-2026", seq: 41 }
```

---

## 8. API contract

Base path `/api/v1`. Consistent envelope on every response.

**Success**

```json
{ "success": true, "data": {}, "meta": {} }
```

**Error**

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

Pagination `meta`: `{ "page": 1, "limit": 24, "total": 1049, "totalPages": 44 }`

### 8.1 Public endpoints (no auth)

| Method | Path                      | Purpose                                          |
| ------ | ------------------------- | ------------------------------------------------ |
| GET    | `/categories`             | Full tree. `?flat=true` for a flat list.         |
| GET    | `/categories/menu`        | `showInMenu` categories shaped for the mega-menu |
| GET    | `/categories/:slug`       | Single category + ancestors for breadcrumb       |
| GET    | `/brands`                 | List, `?active=true`                             |
| GET    | `/brands/:slug`           | Single brand                                     |
| GET    | `/industries`             | List                                             |
| GET    | `/industries/:slug`       | Single industry with content                     |
| GET    | `/products`               | Listing — see query params below                 |
| GET    | `/products/:slug`         | Single product, populated                        |
| GET    | `/products/:slug/related` | 8 products from the same category                |
| GET    | `/products/slugs`         | All active slugs, for `generateStaticParams`     |
| GET    | `/search/suggest`         | Typeahead, `?q=`, max 8 results                  |
| POST   | `/quotations`             | Submit a quotation request                       |
| GET    | `/catalogue/active`       | Active catalogue metadata, no file URL           |
| POST   | `/catalogue/download`     | Lead form → returns a time-limited file URL      |
| GET    | `/health`                 | Liveness probe for UptimeRobot                   |

**`GET /products` query parameters**

| Param        | Type               | Notes                                                                      |
| ------------ | ------------------ | -------------------------------------------------------------------------- |
| `category`   | string \| string[] | Slug(s). Matches `categoryPath`, so a parent slug returns all descendants. |
| `brand`      | string \| string[] |                                                                            |
| `industry`   | string \| string[] |                                                                            |
| `q`          | string             | Text search                                                                |
| `featured`   | boolean            |                                                                            |
| `newArrival` | boolean            |                                                                            |
| `sort`       | enum               | `newest` \| `oldest` \| `name_asc` \| `name_desc` \| `relevance`           |
| `page`       | number             | default 1                                                                  |
| `limit`      | number             | default 24, max 60                                                         |

Response `meta` carries facet counts so the sidebar renders `Welding (312)` without a second round trip:

```json
"meta": {
  "page": 1, "limit": 24, "total": 1049, "totalPages": 44,
  "facets": {
    "categories": [{ "slug": "welding", "name": "Welding", "count": 312 }],
    "brands":     [{ "slug": "kaspro", "name": "KASPRO", "count": 148 }]
  }
}
```

Build facets with a `$facet` aggregation stage so results and counts come from one database round trip.

**`POST /quotations` body**

```json
{
  "customer": { "name": "", "email": "", "phone": "", "company": "", "designation": "" },
  "address": {
    "line1": "",
    "line2": "",
    "city": "",
    "region": "",
    "postalCode": "",
    "country": "Saudi Arabia"
  },
  "items": [{ "productId": "", "quantity": 1, "note": "" }],
  "message": "",
  "turnstileToken": ""
}
```

The server **re-reads every product by ID** and builds the snapshot from the database. It never trusts name, SKU, image, or unit sent by the client. If a `productId` is invalid or inactive, reject the whole submission with `422` and name the offending line so the frontend can highlight it.

**`POST /catalogue/download` body**

```json
{ "name": "", "email": "", "phone": "", "company": "", "turnstileToken": "" }
```

Creates a `CatalogueLead`, increments `downloadCount`, returns `{ "downloadUrl": "..." }`. The URL is a Cloudinary signed delivery URL with a short expiry so it cannot be shared to bypass the form.

### 8.2 Admin endpoints (JWT required)

| Method       | Path                                   | Purpose                                                        |
| ------------ | -------------------------------------- | -------------------------------------------------------------- |
| POST         | `/admin/auth/login`                    | Email + password → tokens                                      |
| POST         | `/admin/auth/refresh`                  | Rotate refresh token                                           |
| POST         | `/admin/auth/logout`                   | Invalidate refresh token                                       |
| GET          | `/admin/auth/me`                       | Current admin profile                                          |
| POST         | `/admin/auth/change-password`          | Required when `mustChangePassword` is true                     |
| GET          | `/admin/dashboard/stats`               | Counts + recent quotations                                     |
| GET/POST     | `/admin/categories`                    | List / create                                                  |
| PATCH/DELETE | `/admin/categories/:id`                | Update / soft delete                                           |
| PATCH        | `/admin/categories/reorder`            | Bulk `displayOrder`                                            |
| GET/POST     | `/admin/brands`                        |                                                                |
| PATCH/DELETE | `/admin/brands/:id`                    |                                                                |
| GET/POST     | `/admin/industries`                    |                                                                |
| PATCH/DELETE | `/admin/industries/:id`                |                                                                |
| GET          | `/admin/products`                      | Paginated, filter by category/brand/status, search name or SKU |
| GET          | `/admin/products/:id`                  | Full record for the edit form                                  |
| POST         | `/admin/products`                      | Create                                                         |
| PATCH        | `/admin/products/:id`                  | Update                                                         |
| DELETE       | `/admin/products/:id`                  | Soft delete                                                    |
| PATCH        | `/admin/products/:id/images/reorder`   | Reorder image array                                            |
| DELETE       | `/admin/products/:id/images/:publicId` | Remove image + Cloudinary destroy                              |
| POST         | `/admin/uploads/signature`             | Cloudinary signed-upload params                                |
| POST         | `/admin/uploads/image`                 | Server-side fallback                                           |
| GET          | `/admin/quotations`                    | Paginated, filter by status + date range, search               |
| GET          | `/admin/quotations/:id`                | Full detail for the modal                                      |
| PATCH        | `/admin/quotations/:id/status`         | Change status, appends to `statusHistory`                      |
| POST         | `/admin/quotations/:id/notes`          | Add internal note                                              |
| DELETE       | `/admin/quotations/:id`                | Soft delete                                                    |
| GET          | `/admin/quotations/export`             | CSV of the filtered set                                        |
| GET/POST     | `/admin/catalogue`                     | List / upload catalogue file                                   |
| PATCH/DELETE | `/admin/catalogue/:id`                 | Update metadata / soft delete                                  |
| PATCH        | `/admin/catalogue/:id/activate`        | Make active, deactivate others                                 |
| GET          | `/admin/catalogue/leads`               | Paginated leads table                                          |
| GET          | `/admin/catalogue/leads/export`        | CSV export                                                     |

---

## 9. Storefront specification

### 9.1 Global shell

**Header** — three bands, sticky on scroll (collapses to the nav band only). Server component except the mega-menu, search, and cart button.

1. _Utility bar_ (dark, `--brand-deep`): support phone, email, business hours, "Download catalogue" link. Hidden below `md`.
2. _Brand bar_: logo left, search centre (expands on focus), quote cart button right with a live item-count badge.
3. _Navigation bar_: Home · Welding · Tools & Equipment · Brands · Industries · Company · Contact.

Welding and Tools & Equipment open a **mega-menu panel**: four to five columns of level-1 groups with their level-2 children beneath, plus a promotional image tile. Full-container width, opens on hover with a 150 ms intent delay and on focus/Enter for keyboard users, closes on `Escape` or outside click.

Menu data is fetched server-side in the root layout with a `categories:menu` cache tag, so it renders in the initial HTML and is crawlable — it is the primary internal linking structure for the whole catalogue.

Below `lg`, nav collapses into a hamburger opening an off-canvas accordion drawer.

**Quote cart drawer** — client component, slides from the right. Line items with thumbnail, name, SKU, quantity stepper, remove. Footer shows total item count and "Review request" linking to `/quote-cart`.

**Footer** — server component, dark, four columns: company blurb + logo + social; Information links; Industries links; contact block with address, phone, email. Catalogue download button in the first column.

### 9.2 Home page

| Section           | Content                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero              | Full-bleed image, short headline, two actions: "Browse catalogue" and "Request a quote". Single orchestrated entrance here and nowhere else. |
| Category grid     | Eight top-level tiles with image, name, product count                                                                                        |
| New arrivals      | Horizontal scroll rail, 12 products, `isNewArrival: true`                                                                                    |
| Featured products | Grid of 8, `isFeatured: true`                                                                                                                |
| Brands strip      | Logo row linking to brand pages                                                                                                              |
| Industries        | Six to nine cards with icon and short description                                                                                            |
| Catalogue band    | Cover thumbnail, short copy, "Download catalogue" opening the lead modal                                                                     |
| Trust band        | Three points: delivery coverage, support hours, certified supply                                                                             |
| CTA band          | Accent band driving to `/quote-request`                                                                                                      |

### 9.3 Category listing page

Two-column, sidebar left at `lg` and above.

**Sidebar** (client component for the interactive filters)

- Breadcrumb-aware category tree, current branch expanded
- Brand checkbox filter with counts
- Industry checkbox filter with counts
- "Clear all filters"
- Promotional banner tile

**Main**

- Breadcrumb
- Category name, description, result count ("Showing 1,049 products")
- Sort dropdown, grid/list toggle
- Product grid: 4 columns `xl`, 3 `lg`, 2 `md`, 2 `sm`
- Load-more button — not infinite scroll, which breaks back-button restoration and hurts crawlability

Filters live in the query string so a filtered view is shareable and restorable. Sidebar becomes a bottom sheet below `lg`.

**Product card:** image with subtle zoom on hover, category eyebrow, name clamped to 2 lines, SKU, "Add to quote" button. No price anywhere.

### 9.4 Product detail page

- Breadcrumb reflecting the full category path
- Left: gallery — main image with hover zoom, thumbnail strip, lightbox on click (client component)
- Right: name, SKU, brand logo linking to the brand page, availability badge, short description, quantity stepper, "Add to quote" (accent), "Request a callback" (secondary)
- Stacked sections: Description · Key Features · Specifications · Downloads
- Related products: 8 from the same category
- Sticky add-to-quote bar on mobile

`generateMetadata` reads the product's `seo` sub-document with fallbacks to `name` and `shortDescription`.

### 9.5 Brand and industry pages

Brand page: banner, logo, description, then the standard product grid filtered to that brand with the same facets.

Industry page: banner, long-form content block, then a product grid filtered to that industry.

### 9.6 Search

- Header input with typeahead after 2 characters, debounced 300 ms, max 8 suggestions
- `Enter` navigates to `/search?q=` with the full listing layout and all facets
- Empty state suggests popular categories rather than a bare "no results"
- `/search` is `force-dynamic` and `noindex`

### 9.7 Catalogue download

Entry points: utility bar link, footer button, home page catalogue band, persistent button on listing pages.

**Flow**

1. Click opens a modal with cover thumbnail, title, version, file size
2. Form: name, company, email, phone, consent checkbox, honeypot, Turnstile
3. On submit, `POST /catalogue/download` creates the lead and returns a signed URL
4. Browser opens the URL in a new tab; the modal shows a success state with a manual "Download again" link in case the popup was blocked

If `requiresLead` is false on the active file, the button links straight to the file with no modal.

### 9.8 Quote cart page (`/quote-cart`)

Line item table: thumbnail, name + SKU, unit, quantity stepper, per-line note, remove. Below: item count summary and "Continue to request details". Empty state links to the catalogue.

Client-rendered, `noindex`.

### 9.9 Quote request page (`/quote-request`)

Two-column: form left, sticky summary right.

**Sections**

1. _Your details_ — name, designation, company, email, phone
2. _Delivery address_ — line 1, line 2, city, region (Saudi province dropdown), postal code, country
3. _Additional requirements_ — free text
4. Consent checkbox

Zod validation matching the server DTO exactly. On submit, disable the button, show progress; on success clear the cart and redirect to the confirmation page.

**Confirmation page** shows the quote number prominently, a summary of what was submitted, expected response time, and a link back to the catalogue. No email is sent to the customer, so this on-screen confirmation is the only receipt they get — it must be clear, complete, and printable.

### 9.10 SEO requirements

Served by Next.js rather than a prerender step.

- `generateMetadata` on every route producing unique title, description, canonical, Open Graph, and Twitter tags from the `seo` sub-document with sensible fallbacks
- `generateStaticParams` for level 0 and level 1 categories and all brands
- JSON-LD: `Organization` on home, `BreadcrumbList` on all listing and detail pages, `Product` on PDPs (with `offers.availability`, no price)
- `sitemap.ts` generating from products, categories, brands, and industries at request time with a 1-hour cache
- `robots.ts` allowing crawl, disallowing `/quote-cart`, `/quote-request`, `/search`
- Semantic heading hierarchy, one `<h1>` per page
- `next/image` throughout with a Cloudinary loader, explicit dimensions, `priority` on the LCP image only
- Trailing-slash behaviour set once in `next.config` and never mixed

---

## 10. Quotation cart behaviour

The cart is **entirely client-side**. No server cart, no session, no cart API.

**State shape**

```ts
type CartItem = {
  productId: string;
  name: string;
  slug: string;
  sku: string;
  imageUrl: string;
  unit: string;
  quantity: number;
  note?: string;
};

type CartState = { items: CartItem[]; updatedAt: number };
```

**Provider:** `CartContext` with `useReducer`, mounted in the root layout as a client component. Actions: `ADD_ITEM`, `REMOVE_ITEM`, `SET_QUANTITY`, `SET_NOTE`, `CLEAR_CART`, `HYDRATE`.

**Persistence:** `localStorage` key `hox.quotecart.v1`, written on every state change via a debounced effect (300 ms). Hydrated once on mount in a `useEffect` with an `isHydrated` flag.

**Hydration mismatch — new risk under SSR.** The server has no access to `localStorage`, so the cart badge must render empty in the server HTML and populate after hydration. Rendering the persisted count directly on first client render throws a React hydration mismatch. Render `null` or a skeleton until `isHydrated` is true. This did not exist in the v1.0 SPA design and is the most likely bug to slip through.

**Expiry:** discard on hydrate if `updatedAt` is older than 30 days.

**Resilience:** wrap all `localStorage` access in try/catch. Private browsing and storage-full conditions throw, and an uncaught throw here white-screens the site.

**Validation on submit:** the server re-validates every `productId`. Items deleted or deactivated since being added produce a `422` naming those lines; the frontend highlights them and offers to remove them so the customer resubmits without losing the rest of the cart.

---

## 11. Admin specification

### 11.1 Shell

Fixed left sidebar (collapsible to icons): Dashboard · Categories · Brands · Industries · Products · Quotations · Catalogue. Top bar with page title, quick search, profile menu with logout.

Data-dense styling — smaller type, tighter spacing than the storefront, tabular figures throughout. Same tokens, different density.

### 11.2 Login

Single centred card: email, password, submit. Rate limited. Generic error on failure — never distinguish "no such user" from "wrong password".

If the account has `mustChangePassword: true`, redirect to a forced password-change screen before any other route is reachable.

### 11.3 Dashboard

- Four stat cards: total products, total categories, new quotations (last 7 days), catalogue downloads (last 30 days)
- Quotations-by-status breakdown
- Recent quotations table, 10 rows, click-through to the detail modal
- Bar chart of quotations per week over the last 8 weeks

### 11.4 Categories page

Table: name (indented by level), parent, level, product count, menu visibility toggle, status toggle, actions.

**Add/edit** in a right-hand slide-over:

- Name (auto-generates slug; slug editable with a uniqueness check)
- Parent category (searchable select; current category and its descendants excluded to prevent cycles)
- Description
- Category image and banner (Cloudinary upload)
- Display order, show-in-menu toggle, active toggle
- SEO accordion: meta title, meta description, keywords

Validation: reject depth greater than 3, reject a cycle-creating parent, reject a duplicate slug with a clear message.

Delete blocked when the category has children or products; the error names the count and links to the filtered product list.

Saving triggers storefront revalidation for `categories:menu` and the affected category tags.

### 11.5 Products page

**List:** paginated table with thumbnail, name, SKU, category, brand, status, updated date, actions. Filters for category, brand, status. Search across name and SKU. Bulk activate/deactivate.

**Add/edit** as a full page, sectioned:

1. _Basic_ — name, slug, SKU, short description
2. _Description_ — TipTap rich text; sanitised server-side with `sanitize-html` before persisting
3. _Key features_ — repeatable single-line inputs, add/remove/reorder
4. _Specifications_ — repeatable label/value pairs, add/remove/reorder
5. _Images_ — drag-and-drop multi-upload, preview, drag-to-reorder, per-image alt text (required), first image marked primary
6. _Classification_ — category (searchable tree select, leaf only), brand, industries (multi-select)
7. _Details_ — unit, minimum order quantity, availability
8. _Visibility_ — active, featured, new arrival, display order
9. _SEO_ — meta title, meta description, keywords, OG image

Unsaved-changes guard on navigate away.

This is the screen the client will spend hundreds of hours in, because the entire catalogue is entered by hand. Keyboard flow matters more here than anywhere else we build: linear tab order through the sections, `Cmd/Ctrl+S` to save, and a **"Save and add another"** action that returns a clean form with category and brand retained from the previous entry. That last detail alone saves the client days of work.

### 11.6 Quotations page

One shared table for the whole team. No routing, no assignment, no per-user inbox.

**Columns:** quote number, date, company, contact name, item count, status badge, actions.

**Filters:** status (multi-select), date range, search across quote number, company, email, contact name.

**Detail modal** (wide, scrollable):

- Header: quote number, submitted date, current status badge
- Customer block: name, designation, company, email (mailto), phone (tel)
- Address block with a "copy address" action
- Items table: thumbnail, name, SKU, unit, quantity, per-line note
- Customer message
- Status control: dropdown with an optional note, writing to `statusHistory`
- Internal notes: existing notes with author and timestamp, plus an add-note field
- Actions: export this quotation as CSV, email the customer (opens the mail client prefilled)

**Status model:** `new` → `in_review` → `quoted` → `won` | `lost`, with `cancelled` reachable from any state. Distinct badge colour per status from §5.1.

Bulk status change from the table for selected rows.

### 11.7 Catalogue page

Two tabs.

**Files tab:** table of uploaded catalogue PDFs with cover thumbnail, title, version, file size, download count, active toggle, actions. Upload form takes title, description, version, cover image, PDF file, and a requires-lead toggle. Activating a file deactivates the rest.

**Leads tab:** table of `CatalogueLead` records with date, name, company, email, phone, and which catalogue was downloaded. Date-range filter, search, CSV export.

---

## 12. Authentication and security

### 12.1 Admin seeding

The seed script creates a single super admin:

```
Email:    superadmin@example.com
Password: @Password123
Role:     super_admin
```

**Guardrails on this credential:**

1. The seed script refuses to run with these default values when `NODE_ENV === 'production'`. In production it requires `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from the environment.
2. The seeded account is created with `mustChangePassword: true`. First login forces a password change before any admin route is reachable.
3. Password policy on change: minimum 12 characters, at least one uppercase, one lowercase, one digit, one symbol, and not equal to the seeded default.

This credential is right for local development and staging, which is what it is for. It must not survive to a live admin panel — `@Password123` on a predictable `superadmin@` address at a public URL is guessable by an automated scanner within minutes. The `mustChangePassword` flag is what makes shipping this default safe.

Add "confirm the super admin password has been rotated" to the go-live checklist.

### 12.2 Token handling

- Access token: JWT, 15 minute expiry, carries `sub`, `email`, `role`
- Refresh token: JWT, 7 day expiry, bcrypt-hashed and stored on the `AdminUser` record
- Both delivered as `httpOnly`, `secure`, `sameSite: 'strict'` cookies. Never `localStorage` — it is XSS-readable there.
- Refresh rotation: each refresh issues a new token and invalidates the old hash
- Axios interceptor on 401 attempts one silent refresh, then redirects to login
- Passwords: bcrypt cost 12
- Login rate limit: 5 attempts per 15 minutes per IP

No public registration endpoint. New admins are created by an existing `super_admin`.

### 12.3 General hardening

| Control               | Implementation                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Input validation      | Global `ValidationPipe`, `whitelist: true, forbidNonWhitelisted: true`                                                          |
| Rate limiting         | `@nestjs/throttler` — 100 req/min global, 5/15min login, 3/hour per IP on quotation submit, 5/hour per IP on catalogue download |
| CORS                  | Explicit origin allowlist from env. Never `origin: '*'` with credentials.                                                       |
| Headers               | Helmet with a configured CSP                                                                                                    |
| NoSQL injection       | Never pass raw request objects into query filters. Cast and validate every operator.                                            |
| HTML sanitisation     | `sanitize-html` on all rich text before persisting                                                                              |
| Secrets               | Zod-validated env schema at boot; the app refuses to start on a missing or malformed variable                                   |
| Spam                  | Honeypot field plus Cloudflare Turnstile on the quotation form and the catalogue download form                                  |
| Revalidation endpoint | Shared secret header; mismatches rejected and logged                                                                            |
| Error responses       | Never leak stack traces or Mongo errors in production                                                                           |

---

## 13. Cloudinary integration

### 13.1 Upload flow

**Signed direct-to-Cloudinary uploads** from the admin browser, not proxied through the API.

1. Admin selects files
2. Frontend calls `POST /admin/uploads/signature` with the target folder and resource type
3. Backend returns `{ signature, timestamp, apiKey, cloudName, folder, resourceType }`
4. Frontend uploads directly to Cloudinary, receives `secure_url` + `public_id`
5. Frontend submits those references with the form
6. Backend persists them

This keeps large bodies off a free-tier API server with tight memory limits. The catalogue PDF in particular can be tens of megabytes and should never touch the Node process.

### 13.2 Folders and transformations

```
/<project>/products/<productId>/
/<project>/categories/
/<project>/brands/
/<project>/industries/
/<project>/banners/
/<project>/catalogue/          # resource_type: raw, PDFs
```

Image upload preset: `quality: auto`, `fetch_format: auto`, max dimension 2000px.

| Context         | Transformation                            |
| --------------- | ----------------------------------------- |
| Product card    | `w_400,h_400,c_pad,b_white,q_auto,f_auto` |
| PDP main        | `w_800,h_800,c_pad,b_white,q_auto,f_auto` |
| PDP thumbnail   | `w_120,h_120,c_pad,b_white,q_auto,f_auto` |
| Admin thumbnail | `w_80,h_80,c_fill,q_auto,f_auto`          |
| Banner          | `w_1600,c_fill,q_auto,f_auto`             |
| Catalogue cover | `w_400,c_fit,q_auto,f_auto`               |

Use `c_pad` with a white background on product images rather than `c_fill`. Industrial products are irregularly shaped and cropping cuts off the part the buyer is trying to identify.

Build a `cloudinaryUrl(publicId, preset)` helper and use it everywhere. Never store transformed URLs — store the `publicId` and base `secure_url` only.

### 13.3 Catalogue PDF delivery

Upload with `resource_type: 'raw'` and `type: 'authenticated'`. Generate a signed delivery URL with a 15-minute expiry at download time, so the URL cannot be shared to bypass the lead form. A public URL would make the lead capture decorative.

### 13.4 Deletion

Deleting a product image calls the Cloudinary destroy API for that `publicId`. Soft-deleting a product does **not** delete its images — the action is reversible. A manual reconciliation script identifies orphaned assets.

### 13.5 Free tier budget

25 monthly credits ≈ 25 GB storage or 25 GB bandwidth. At roughly 200 KB per optimised image and 3 images per product, 1,000 products is about 600 MB — comfortable.

Bandwidth is the constraint, and the catalogue PDF is the new risk: a 30 MB PDF downloaded 300 times is 9 GB, more than a third of the monthly allowance on its own. Compress the PDF before upload, show the file size on the download button so users self-select, and review `downloadCount` monthly.

---

## 14. Infrastructure

### 14.1 MongoDB Atlas M0

- **512 MB storage.** Ample. 5,000 products with rich text is roughly 50 MB.
- **500 connection limit.** Set `maxPoolSize: 10`. Do not leave the default.
- **Shared CPU.** Every listing query must be index-backed. Run `explain()` during Phase 2 and confirm `IXSCAN`, not `COLLSCAN`.
- **No dedicated backups on M0.** Schedule a `mongodump` to object storage. Do not skip this because the project is small — the client is hand-entering thousands of products and losing that work is unrecoverable.
- M0 is a three-node replica set, so transactions are available. Use one for `CatalogueFile` activation (deactivate all, activate one) to avoid a window with zero or two active files.

### 14.2 API hosting and cold starts

Render's free tier spins down after 15 minutes of inactivity, and the cold start is 30–50 seconds. UptimeRobot pinging a `/health` endpoint every 5 minutes keeps it warm.

**Two things to budget for:**

1. Render's free tier allows 750 instance-hours per month across the account. One service kept awake 24/7 consumes roughly 730 of them. That works for exactly one always-on service and leaves no headroom. If a staging API also needs to stay up, one of the two must be allowed to sleep or the account moves to paid.
2. Free instances still restart on deploy and occasionally on the platform's own schedule. The pinger reduces cold starts, it does not eliminate them. The storefront degrades gracefully here — ISR means most pages serve from cache even when the API is briefly unavailable, which is a real side benefit of the Next.js decision.

Add the `/health` endpoint in Phase 1, not Phase 7, so the pinger is configured before staging goes up.

At roughly $7/month, a paid instance removes this entire class of problem. Worth raising with the client as a small line item.

### 14.3 Environment variables

**API (NestJS)**

```
NODE_ENV=production
PORT=4000
API_PREFIX=/api/v1

MONGODB_URI=
MONGODB_DB_NAME=

JWT_ACCESS_SECRET=
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=12

SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=

STOREFRONT_ORIGIN=
ADMIN_ORIGIN=

STOREFRONT_REVALIDATE_URL=
REVALIDATE_SECRET=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=
QUOTATION_NOTIFY_TO=
QUOTATION_NOTIFY_ENABLED=true

TURNSTILE_SECRET_KEY=
```

**Storefront (Next.js)**

```
API_INTERNAL_URL=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
REVALIDATE_SECRET=
```

**Admin (Vite)**

```
VITE_API_URL=
```

All validated with Zod at boot. The process exits on a missing or invalid value rather than starting broken.

### 14.4 Deployment

| App        | Host                     | Notes                                    |
| ---------- | ------------------------ | ---------------------------------------- |
| Storefront | Vercel                   | Next.js 15, ISR + on-demand revalidation |
| Admin      | Vercel, separate project | `admin.<domain>`, static SPA build       |
| API        | Render free tier         | UptimeRobot on `/health` every 5 min     |
| Database   | MongoDB Atlas M0         | Scheduled `mongodump`                    |
| Assets     | Cloudinary Free          |                                          |

All accounts registered in the **client's name** with HOX added as a collaborator, per standard practice.

---

## 15. Non-functional requirements

### 15.1 Performance targets

| Metric                          | Target                                                      |
| ------------------------------- | ----------------------------------------------------------- |
| Largest Contentful Paint        | < 2.0 s on 4G (tighter than v1.0 — SSR should beat the SPA) |
| Cumulative Layout Shift         | < 0.1                                                       |
| Interaction to Next Paint       | < 200 ms                                                    |
| Listing API response (p95)      | < 400 ms                                                    |
| Lighthouse Performance (mobile) | > 90                                                        |
| Lighthouse SEO                  | > 95                                                        |

Techniques: ISR, server components for everything non-interactive, `next/font` self-hosting, Cloudinary `f_auto`/`q_auto`, `next/image` with explicit dimensions, `.lean()` on all read-only Mongoose queries, in-memory cache on the category tree and menu endpoints.

### 15.2 Browser support

Chrome, Edge, Firefox, Safari — last two major versions. iOS Safari 16+, Chrome Android last two. No IE11.

### 15.3 Responsive

Mobile-first. Tested at 360, 390, 768, 1024, 1440, 1920 px. The mega-menu, filter sidebar, product grid, quotation form, catalogue modal, and every admin table need explicit mobile treatments — admin tables become stacked cards below `md`.

### 15.4 Code quality

- ESLint + Prettier enforced in CI
- TypeScript strict, no `any` without a comment justifying it
- Conventional commits
- `CLAUDE.md` at repo root documenting conventions, folder structure, the three-layer backend pattern, and the server/client component rules, so Claude Code output stays consistent across all three developers
- Backend: unit tests on services with real logic (category tree, quote number generation, product filter builder, catalogue activation), e2e tests on auth, quotation submission, and catalogue download
- Frontend: tests on the cart reducer, the quotation form validation, and the hydration guard

---

## 16. Repository structure

Monorepo with npm workspaces.

```
/
├─ CLAUDE.md
├─ README.md
├─ package.json
├─ apps/
│  ├─ api/                      # NestJS
│  │  ├─ src/
│  │  │  ├─ common/             # guards, filters, interceptors, decorators
│  │  │  ├─ config/             # Zod env schema
│  │  │  ├─ database/           # connection, seeds
│  │  │  ├─ modules/
│  │  │  │  ├─ auth/
│  │  │  │  ├─ categories/
│  │  │  │  ├─ brands/
│  │  │  │  ├─ industries/
│  │  │  │  ├─ products/
│  │  │  │  ├─ quotations/
│  │  │  │  ├─ catalogue/
│  │  │  │  ├─ uploads/
│  │  │  │  ├─ search/
│  │  │  │  ├─ revalidation/    # calls the storefront purge endpoint
│  │  │  │  ├─ health/
│  │  │  │  └─ dashboard/
│  │  │  └─ main.ts
│  │  └─ test/
│  ├─ storefront/               # Next.js 15 App Router
│  │  ├─ app/
│  │  │  ├─ (marketing)/        # about, contact
│  │  │  ├─ category/[slug]/
│  │  │  ├─ products/
│  │  │  │  └─ [slug]/
│  │  │  ├─ brands/
│  │  │  │  └─ [slug]/
│  │  │  ├─ industries/[slug]/
│  │  │  ├─ search/
│  │  │  ├─ quote-cart/
│  │  │  ├─ quote-request/
│  │  │  │  └─ success/[quoteNumber]/
│  │  │  ├─ api/revalidate/route.ts
│  │  │  ├─ sitemap.ts
│  │  │  ├─ robots.ts
│  │  │  └─ layout.tsx
│  │  ├─ components/            # server/ and client/ clearly separated
│  │  ├─ context/               # CartContext, UIContext (client)
│  │  ├─ lib/                   # api client, cloudinary, seo helpers
│  │  └─ types/
│  └─ admin/                    # React + Vite SPA
│     └─ src/
│        ├─ components/
│        ├─ context/            # AuthContext, UIContext
│        ├─ pages/
│        ├─ hooks/
│        ├─ lib/
│        └─ types/
├─ packages/
│  ├─ shared-types/             # DTO and entity types for all three apps
│  └─ design-tokens/            # tokens.css + Tailwind preset
└─ docs/
   ├─ API_CONTRACT.md
   ├─ DATA_MODEL.md
   └─ DESIGN_TOKENS.md
```

Each API module follows `*.controller.ts` → `*.service.ts` → `*.schema.ts` with `dto/` and `*.module.ts`.

---

## 17. Delivery plan

Three developers: **BE** (backend), **AD** (admin frontend), **SF** (storefront frontend).

| Phase                | Days | BE                                                                                                                                                          | AD                                                                                                    | SF                                                                                                                         |
| -------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **0. Planning**      | 2    | All three: finalise schema, API contract, screen inventory, sample and lock design tokens, write `CLAUDE.md`                                                |                                                                                                       |                                                                                                                            |
| **1. Foundation**    | 5    | NestJS scaffold, Mongo connection, env validation, auth module, admin seed with forced password change, Cloudinary service, `/health`, taxonomy seed script | App shell, sidebar, routing, auth context, forced-password-change screen, table/form/modal primitives | Next.js scaffold, App Router structure, layout, header, mega-menu, footer, tokens, server/client boundaries established    |
| **2. Catalogue**     | 8    | Categories, brands, industries, products modules; facet aggregation; text search; revalidation module                                                       | Category slide-over; brand and industry CRUD; product list; product form with image uploader          | Listing page with facets; PDP; search + typeahead; brand and industry pages; `generateMetadata` and `generateStaticParams` |
| **3. Quotation**     | 4    | Quotation module, counter, snapshot logic, internal notification email, Turnstile verification                                                              | Quotations table, detail modal, status control, notes, CSV export                                     | Cart context with hydration guard, drawer, cart page, quote request form, confirmation page                                |
| **4. Catalogue PDF** | 2    | CatalogueFile + CatalogueLead modules, signed raw upload, expiring delivery URL, activation transaction                                                     | Catalogue files tab, leads tab, CSV export                                                            | Download modal with lead form, entry points in header, footer, home band, listing pages                                    |
| **5. Content & SEO** | 3    | Sitemap data endpoints, cache layer on menu and tree                                                                                                        | Dashboard, stats wiring                                                                               | Home page finish, About, Contact, JSON-LD, `sitemap.ts`, `robots.ts`, ISR tuning                                           |
| **6. Hardening**     | 3    | Rate limiting, Helmet, `explain()` verification, Swagger, tests                                                                                             | Responsive pass, empty/error/loading states, a11y pass                                                | Responsive pass, Lighthouse, a11y pass, image optimisation                                                                 |
| **7. QA & deploy**   | 4    | Shared: integration testing, bug fixing, staging deploy, UptimeRobot setup, backup cron, UAT support                                                        |                                                                                                       |                                                                                                                            |

**Total: 31 working days ≈ 6.2 weeks.**

Recommended client-facing commitment: **8 weeks**, covering feedback rounds and go-live coordination.

_Movement from v1.0: +2 days for the catalogue PDF feature, +2 days for Next.js (App Router setup, server/client boundary discipline, ISR and revalidation wiring), partly offset by dropping the prerender workaround._

### 17.1 Critical path and risks

1. **Backend is the structural bottleneck.** One backend developer serving two frontend developers means any API slip blocks two people. Publish `API_CONTRACT.md` on day 2 of Phase 0 and stand up MSW mock handlers from it immediately, so both frontend developers work against mocks from day one of Phase 1 and swap to real endpoints as they land.

2. **Server/client boundary discipline is the new Next.js risk.** The common failure is marking a layout `'use client'` to make a context work, which silently converts the whole tree to client rendering and throws away the reason we chose Next.js. Establish the pattern in Phase 1, document it in `CLAUDE.md`, enforce it in review. A Lighthouse regression is the symptom, so run Lighthouse at the end of every phase, not only in Phase 6.

3. **The product form is the single largest admin screen.** Budget 3 of the 8 Phase 2 days for it alone. Image upload with reorder and per-image alt text is where the time goes. It also has the highest usage of anything we build, since the client enters the entire catalogue through it — "Save and add another" is not a nice-to-have.

4. **Facet counts on shared-CPU M0.** Verify `$facet` performance against at least 1,000 seeded products during Phase 2, not Phase 7. If slow, precompute counts on write.

5. **Content entry is the real go-live gate.** With no import path and no existing data, every SKU is typed in by hand. At an optimistic 4 minutes per product including image upload, 1,000 products is over 65 hours of client-side work. The software will be ready before the catalogue is. Set expectations at kickoff, agree who is doing the entry, and consider a soft launch with a few hundred products rather than blocking go-live on a full catalogue.

6. **Render free-tier hours.** 750 hours per month covers exactly one always-on service. If staging also needs to stay warm, plan for the paid tier.

---

## 18. Resolved decisions

Recorded from the client review of v1.0.

| #   | Question                             | Decision                                                                                                                                                  |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Exact brand colours                  | Sample from `primearabiagroup.com` and confirm. Action item before Phase 1.                                                                               |
| 2   | SEO rendering                        | **Next.js.** Storefront on App Router with ISR. Admin stays a Vite SPA.                                                                                   |
| 3   | Arabic                               | _Still open — see below._                                                                                                                                 |
| 4   | Catalogue size and content ownership | Client enters everything through the admin UI. Seed a super admin (`superadmin@example.com` / `@Password123`) with forced password change on first login. |
| 5   | Existing product data                | None. No import script.                                                                                                                                   |
| 6   | Quotation routing                    | One shared quotations page. No routing, no assignment.                                                                                                    |
| 7   | Customer emails                      | None. On-screen confirmation only. Internal notification to a shared address stays, toggleable via `QUOTATION_NOTIFY_ENABLED`.                            |
| 8   | API hosting                          | Render free tier + UptimeRobot. See §14.2 for the hours budget.                                                                                           |
| 9   | Migration and redirects              | None. Data entered manually.                                                                                                                              |
| 10  | Catalogue PDF download               | **In scope.** Gated behind a lead form, with a leads table in admin.                                                                                      |
| 11  | Phases                               | Single delivery. No phase 2. All phase-2 language removed from this document.                                                                             |

### The one question still open

**Arabic and RTL.** Not answered in the review, and with no phase 2 the decision is now binary rather than deferrable.

Building for Arabic later without preparing for it now means touching every component for RTL layout mirroring plus extracting every hardcoded string — realistically 1.5 to 2 weeks of rework on a finished codebase.

Preparing for it now costs close to nothing: put UI strings in a locale file instead of inline in JSX, and use Tailwind logical properties (`ps-4`/`pe-4` rather than `pl-4`/`pr-4`) from the first component. Neither slows the build.

Recommendation: do both cheap things regardless of the answer, and do not build the Arabic content layer. If the client later wants Arabic, it becomes a scoped follow-on engagement instead of a rewrite. Confirm at kickoff.

---

## 19. Acceptance criteria

Complete when all of the following are demonstrably true on staging.

**Storefront**

1. A visitor can browse the full category tree from the mega-menu and reach any leaf category.
2. A category listing shows products from that category and all descendants, with working brand and industry facets and accurate counts.
3. Filters, sort, and page state are reflected in the URL and survive a refresh and a back-navigation.
4. Search returns relevant results and typeahead responds within 300 ms.
5. A product detail page shows gallery, description, key features, specifications, and related products.
6. A visitor can add items to the quote cart, change quantities, add per-line notes, and remove items.
7. The cart survives a page refresh and a browser restart, with no hydration mismatch warning in the console.
8. A visitor can submit a quotation and receives an on-screen confirmation with a quote number.
9. No price is displayed anywhere on the storefront.
10. A visitor can download the catalogue PDF after completing the lead form, and the returned URL expires.
11. The catalogue PDF cannot be accessed without going through the lead form.
12. Every page has a unique title, meta description, canonical URL, and valid JSON-LD, all present in the server-rendered HTML with JavaScript disabled.
13. `sitemap.xml` lists all active products, categories, brands, and industries.
14. Lighthouse mobile scores meet §15.1.
15. The full flow works at 360 px width.

**Admin**

16. An admin logging in with the seeded credential is forced to change the password before reaching any other screen.
17. An admin can log in and is redirected to login on token expiry without silently losing unsaved work.
18. An admin can create, edit, and delete categories at all three levels, and the storefront mega-menu reflects the change within seconds, not an hour.
19. Deleting a category with children or products is blocked with a clear message naming the blocker.
20. An admin can create a product with multiple images, reorder them, set alt text, and assign category, brand, and industries.
21. "Save and add another" returns a clean form with category and brand retained.
22. An admin can see all quotations in one filterable table and open any one in a detail modal.
23. An admin can change quotation status and add internal notes; status history records who changed what and when.
24. An admin can upload a catalogue PDF, activate it, and see the previously active file deactivate automatically.
25. An admin can view and export catalogue download leads.
26. All admin routes reject unauthenticated requests with 401.

**System**

27. A quotation submitted for a product later deleted still renders correctly in the admin detail modal.
28. Concurrent quotation submissions produce unique, sequential quote numbers.
29. The API refuses to start with a missing environment variable.
30. All product listing queries use an index, verified via `explain()`.
31. Saving a product triggers storefront revalidation, and a failed revalidation does not fail the save.
32. The revalidation endpoint rejects requests with a missing or incorrect secret.
33. A new quotation triggers an internal notification email within 60 seconds when enabled.
34. `/health` responds within 200 ms and UptimeRobot is polling it.
35. A `mongodump` backup has run successfully at least once and has been test-restored.
