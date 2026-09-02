# CLAUDE.md — ISD Arabia

Conventions for this repository. Read before writing code. The authoritative
requirements live in `PROJECT_PLAN.md`; this file records _how_ we implement them.

---

## 1. What this is

A single-vendor **B2B industrial catalogue with a quotation-based enquiry flow**.
Welding and MRO consumables, sold B2B in Saudi Arabia.

**There is no checkout.** Non-negotiable rules that follow from that:

- **No price field anywhere** — not in a schema, not in a DTO, not in a type, not
  "commented out for later". An unused price field eventually leaks into a
  response or a template on a site whose whole premise is "price on request".
- No customer accounts, no payments, no stock levels, no order management.
- The cart is a **quotation cart**, client-side only. No server cart, no session.

## 2. Repository layout

```
apps/
  api/         NestJS 11 REST API      → @isd/api
  storefront/  Next.js 15 App Router   → @isd/storefront
  admin/       React 19 + Vite SPA     → @isd/admin
packages/
  shared-types/    entity + DTO types for all three apps  → @isd/shared-types
  design-tokens/   tokens.css + Tailwind preset           → @isd/design-tokens
docs/
```

npm workspaces. Install once at the root: `npm install`. Never `npm install`
inside an app directory.

## 3. Backend conventions (`apps/api`)

### Three-layer pattern, always

```
*.controller.ts   HTTP only: routing, DTO binding, swagger decorators, guards.
                  No business logic. No direct model access.
*.service.ts      All business logic. Owns the Mongoose model. Returns plain
                  objects (`.lean()`), never Mongoose documents, to callers.
*.schema.ts       Mongoose schema + indexes. No logic beyond hooks that are
                  purely about persistence.
dto/              class-validator DTOs. One file per operation.
*.module.ts       Wiring only.
```

A controller that touches `this.model` is a bug. A service that reads
`@Req()` is a bug.

### Response envelope

Every response goes through the global interceptor / filter:

```jsonc
{ "success": true,  "data": {}, "meta": {} }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [] } }
```

Services throw Nest `HttpException` subclasses; the global filter shapes them.
Never build an error envelope by hand in a controller.

### Query rules

- `.lean()` on every read-only query. Always.
- Every listing query must be index-backed — verify with `explain()`
  (`IXSCAN`, never `COLLSCAN`). MongoDB Atlas M0 is shared CPU.
- Never spread a raw request object into a query filter. Cast and validate
  every field and operator (NoSQL injection).
- Soft delete everywhere: `isDeleted: false` on every public query.
- `maxPoolSize: 10` on the connection — M0 caps at 500 connections.

### Writes trigger revalidation

After a successful write to a product / category / brand / industry, the service
calls `RevalidationService.revalidate(tags)` — **fire and forget, logged on
failure**. A failed revalidation must never fail the admin's save.

## 4. Storefront conventions (`apps/storefront`)

### Server components by default

This is the single most important rule in the repo. We chose Next.js for organic
search; client-rendering the tree throws that away.

- Pages, layouts, grids, cards, spec tables, footers: **server components**.
  They `fetch` the API directly with cache tags.
- `'use client'` goes on the **leaf** that needs interactivity, never on a layout
  or a page. Marking a layout `'use client'` to make a context work converts the
  entire subtree to client rendering. If you feel the urge, you want a client
  provider that renders `{children}` as a prop instead.
- Legitimate client components: cart provider + drawer, add-to-quote button,
  quantity stepper, mega-menu, search typeahead, filter sidebar, image gallery,
  quote request form, catalogue download modal.

**Symptom of getting this wrong:** a Lighthouse regression, or catalogue content
missing from view-source with JS disabled. Check both at the end of every phase.

### Fetching

```ts
fetch(`${process.env.API_INTERNAL_URL}/products/${slug}`, {
  next: { tags: [`product:${slug}`, 'products:list'], revalidate: 86400 },
});
```

Tag **every** server-side fetch. Untagged fetches cannot be purged on demand.

- `API_INTERNAL_URL` — server-side only, may be private.
- `NEXT_PUBLIC_API_URL` — browser fetches.
- Never put a secret behind `NEXT_PUBLIC_`.

### Cart hydration

`localStorage` does not exist on the server. The cart badge renders empty in
server HTML and fills in after hydration. Render `null`/skeleton until
`isHydrated` is true — reading persisted state on first client render is a React
hydration mismatch. Wrap every `localStorage` access in try/catch; private
browsing throws and an uncaught throw white-screens the site.

## 5. Admin conventions (`apps/admin`)

Vite SPA, never crawled, no SSR. Data-dense: smaller type, tighter spacing than
the storefront, `font-variant-numeric: tabular-nums` on every table.

Auth lives in `httpOnly` cookies — **never** read or write tokens in
`localStorage`. The Axios instance uses `withCredentials: true`; a 401 triggers
exactly one silent refresh attempt, then a redirect to login.

## 6. Styling

- Tokens only. `packages/design-tokens/tokens.css` defines primitives and a
  semantic layer; components reference **semantic tokens only**.
- **Never hardcode a hex in a component.** If a colour is missing, add a token.
- The orange accent (`--action-primary`) is reserved for quote actions and the
  catalogue download. It always means "this moves you toward a commercial
  conversation". Not for decoration, dividers, or generic emphasis.
- Radius: `4px` inputs/buttons, `6px` cards, `0` on the header bar and full-bleed
  sections. Elevation: two levels only — `shadow-sm` resting cards, `shadow-lg`
  modals/dropdowns. Nothing else gets a shadow.
- Use **logical properties** (`ps-4`/`pe-4`/`ms-*`/`me-*`, `text-start`), never
  `pl-*`/`pr-*`/`text-left`. Costs nothing now, saves ~2 weeks if Arabic is ever
  approved. See §8.
- All motion respects `prefers-reduced-motion: reduce`. One orchestrated moment
  on the home hero and nowhere else.

## 7. TypeScript

- `strict: true` in all three apps.
- No `any` without a comment on the same line justifying it.
- Shared entity and DTO shapes live in `@isd/shared-types`. If the API and a
  frontend both describe the same object, it belongs there — duplicated
  interfaces drift silently.

## 8. Localisation posture

Arabic/RTL is **out of scope** (`PROJECT_PLAN.md` §18), but two cheap habits are
mandatory so it stays a scoped follow-on rather than a rewrite:

1. UI strings go in a locale file, not inline in JSX.
2. Tailwind logical properties only (§6).

Do not build a content translation layer.

## 9. Accessibility floor

WCAG 2.1 AA. Visible focus ring on every interactive element — never
`outline: none` without a replacement. Modals trap focus and restore it on close.
Mega-menu is arrow-key navigable, `Escape` closes. Real `<label>` elements;
errors announced via `aria-live`. Every image carries meaningful `alt`, and the
admin image uploader **requires** alt text.

## 10. Git

Conventional commits: `feat(api): …`, `fix(storefront): …`, `chore: …`.
Scopes: `api`, `storefront`, `admin`, `tokens`, `types`, `docs`.

## 11. Traps already hit

Each of these cost real debugging time and is now guarded by a test. Read
before changing the code near them.

**`@nestjs/throttler`: every named throttler applies to every route.** Declaring
the per-route buckets in `forRoot` silently capped the whole API at the
strictest one. Only `default` is global; tighter limits override it at the
handler with `@Throttle({ default: { … } })`.

**bcrypt truncates at 72 bytes.** Refresh tokens are far longer and share a long
common prefix, so bcrypt hashed a rotated-out token and its replacement
identically — rotation did nothing. Refresh tokens are stored as a SHA-256
digest. Never bcrypt a long, high-entropy value.

**`$text` cannot appear inside `$facet`,** and a `$facet` sub-pipeline can only
narrow what the top-level `$match` passed. The listing aggregation therefore
matches on the base filter only, materialises the relevance score with
`$addFields` before the `$facet`, and applies each dimension inside the branch
that needs it. Do not move the dimension filters up into the top-level match —
every facet count would collapse to the result count.

**`timestamps: true` does not declare `createdAt`/`updatedAt`.** Each schema
class declares them explicitly so reads do not need a cast.

**`UseFormRegister<any>` is not a supertype.** `register` is contravariant in
its field name, so a concrete `UseFormRegister<FormValues>` will not assign to
it. Shared form components declare only the field paths they actually register.

**sanitize-html pulls in an ESM-only parser.** Node ≥20.19 is required (see
root `engines`), and the Jest e2e config transforms that subtree rather than
skipping it like the rest of `node_modules`.
