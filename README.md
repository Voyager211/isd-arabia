# ISD Arabia

B2B industrial catalogue and quotation platform — welding and MRO consumables,
sold B2B in Saudi Arabia.

Requirements live in [PROJECT_PLAN.md](PROJECT_PLAN.md). Code conventions live in
[CLAUDE.md](CLAUDE.md) — read it before contributing.

**This is not a transactional storefront.** There is no pricing, no checkout, no
payment gateway and no customer accounts. Visitors browse the catalogue, build a
quotation cart, and submit it as an enquiry.

---

## Applications

| Path                     | Package              | Stack                 | Purpose                            |
| ------------------------ | -------------------- | --------------------- | ---------------------------------- |
| `apps/api`               | `@isd/api`           | NestJS 11 · MongoDB 8 | REST API, admin auth, uploads      |
| `apps/storefront`        | `@isd/storefront`    | Next.js 15 App Router | Public catalogue, SSR + ISR        |
| `apps/admin`             | `@isd/admin`         | React 19 · Vite       | Admin SPA behind a login           |
| `packages/shared-types`  | `@isd/shared-types`  | TypeScript            | Entity and DTO types for all three |
| `packages/design-tokens` | `@isd/design-tokens` | CSS                   | Tokens + Tailwind v4 theme bridge  |

Two frontend frameworks is deliberate: the storefront needs server rendering for
organic search, the admin will never be crawled. See PROJECT_PLAN.md §3.2.

## Getting started

```bash
npm install          # once, at the root — never inside an app directory
npm run build:types  # shared-types must be built before the apps compile
```

Copy the env templates and fill them in:

```bash
cp apps/api/.env.example        apps/api/.env
cp apps/storefront/.env.example apps/storefront/.env.local
cp apps/admin/.env.example      apps/admin/.env.local
```

The API validates its environment with Zod at boot and **exits on a missing or
malformed variable**, listing every failure at once. That is intentional — a
half-configured deploy should fail loudly at start, not at the first request.

Generate the JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Running

All three at once, with prefixed output:

```bash
npm run dev
```

| App        | URL                               |
| ---------- | --------------------------------- |
| API        | http://localhost:4000/api/v1      |
| Swagger    | http://localhost:4000/api/v1/docs |
| Storefront | http://localhost:3000             |
| Admin      | http://localhost:5173             |

Or individually:

```bash
npm run dev:api
npm run dev:storefront
npm run dev:admin
```

Sign in to the admin with the seeded credential — `superadmin@example.com` /
`@Password123` — and it will force a password change before any other screen
is reachable.

Both frontend origins must appear in the API's `STOREFRONT_ORIGIN` and
`ADMIN_ORIGIN`, or the browser will block every request as a CORS failure.

**If a port is already taken**, Next.js quietly moves to 3001 and two dev
servers then fight over the same `.next` directory, which fails with
`Expected clientReferenceManifest to be defined`. Free the port rather than
letting it fall back:

```bash
npx kill-port 3000 4000 5173     # or find the PID with: netstat -ano | findstr :3000
rm -rf apps/storefront/.next     # only if it has already gone wrong
```

### Seeding

```bash
npm run seed            # super admin + taxonomy
npm run seed -- --only=taxonomy
```

Idempotent — every write is an upsert keyed on slug or email, and existing
records keep their edits. The client owns this data through the admin UI from
day one, so a second run must never overwrite their work.

Demo products are opt-in and refused in production:

```bash
npm run seed:demo --workspace @isd/api            # 1,500 by default
npm run seed:demo --workspace @isd/api -- --count=5000
```

They give the client something to click through before any real data exists,
and provide the volume the facet performance suite needs. The command prints
how to remove them again.

The seeded credential is `superadmin@example.com` / `@Password123` with
`mustChangePassword` set. It is refused outright in production, where
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are required.

## Scripts

| Command             | Effect                                |
| ------------------- | ------------------------------------- |
| `npm run build`     | Build every workspace, packages first |
| `npm run typecheck` | `tsc --noEmit` across all workspaces  |
| `npm test`          | Unit tests (API + storefront)         |
| `npm run lint`      | ESLint across all workspaces          |
| `npm run format`    | Prettier write                        |

API end-to-end tests need a downloaded mongod binary and run separately:

```bash
npm run test:e2e --workspace @isd/api
```

## Deployment

| App        | Host                     | Notes                                     |
| ---------- | ------------------------ | ----------------------------------------- |
| Storefront | Vercel                   | ISR + on-demand revalidation              |
| Admin      | Vercel, separate project | `admin.<domain>`, static SPA              |
| API        | Render free tier         | UptimeRobot on `/health` every 5 min      |
| Database   | MongoDB Atlas M0         | Schedule a `mongodump`; M0 has no backups |
| Assets     | Cloudinary Free          | Images + the catalogue PDF                |

Render's free tier sleeps after 15 minutes with a 30–50s cold start, and 750
instance-hours per month covers exactly one always-on service. See
PROJECT_PLAN.md §14.2 before adding a staging API.

## Go-live checklist

Beyond the acceptance criteria in PROJECT_PLAN.md §19:

- [ ] **Rotate the super admin password.** `@Password123` on a predictable
      address at a public URL is guessable by a scanner within minutes.
- [ ] Confirm the brand colour primitives in `packages/design-tokens/tokens.css`
      against the sampled reference (PROJECT_PLAN.md §5.1).
- [ ] Replace the placeholder contact block in `apps/storefront/lib/site-config.ts`.
- [ ] Set `REVALIDATE_SECRET` to the same value in the API and the storefront.
- [ ] Point UptimeRobot at `/api/v1/health`.
- [ ] Schedule the `mongodump` backup job.
- [ ] Verify listing queries use `IXSCAN` via `explain()` against real data.

---

## Status

Phases 0–6 of the delivery plan are built and verified. Phase 7 (staging
deploy, UAT) needs real infrastructure and is not something the codebase can
complete on its own.

| Phase            | State | Notes                                                  |
| ---------------- | ----- | ------------------------------------------------------ |
| 0. Planning      | Done  | Tokens, schema, API contract, CLAUDE.md                |
| 1. Foundation    | Done  | Auth, config, uploads, revalidation, health, seeds     |
| 2. Catalogue     | Done  | Taxonomy + products, facets, listing pages, PDP, admin |
| 3. Quotation     | Done  | Submission, snapshots, admin table, notification email |
| 4. Catalogue PDF | Done  | Gated download, signed URLs, leads, admin tabs         |
| 5. Content & SEO | Done  | Home, About, Contact, JSON-LD, sitemap, dashboard      |
| 6. Hardening     | Done  | Lint/CI, rate limits, headers, index verification      |
| 7. QA & deploy   | Open  | Needs Atlas, Cloudinary, Render and Vercel accounts    |

**Verification:** 39 unit and 100 end-to-end tests; typecheck, lint,
format-check and build clean across all five workspaces. CI runs the same
sequence on every push.

### Not yet done, and why

- **Lighthouse and the responsive/a11y sweep.** Both need the app running
  against real data. The targets in `PROJECT_PLAN.md` §15.1 have not been
  measured — the code was written to them, which is not the same thing.
- **Facet performance on Atlas M0** (§17.1 risk 4). `facet-performance.e2e-spec.ts`
  now runs the aggregation against 1,200 products and checks correctness at
  volume, index coverage and the examined-to-returned ratio. What it cannot
  check is the §15.1 latency target: it runs against an in-memory mongod with
  no network hop and no noisy neighbours, whereas M0 is shared CPU on a remote
  host. Re-measure against staging.
- **Brand colours.** `packages/design-tokens/tokens.css` still holds the
  placeholder direction from §5.1. Sampling and confirming them is a
  five-minute change that re-themes everything.
- **Contact details.** `apps/storefront/lib/site-config.ts` has placeholders.
- **Arabic.** The two cheap habits from §18 are in place throughout — UI
  strings in a locale file, logical properties everywhere — so this stays a
  scoped follow-on. The decision itself is still open.
