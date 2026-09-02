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

```bash
npm run dev:api         # http://localhost:4000/api/v1  (docs at /api/v1/docs)
npm run dev:storefront  # http://localhost:3000
npm run dev:admin       # http://localhost:5173
```

### Seeding

```bash
npm run seed            # super admin + taxonomy
npm run seed -- --only=taxonomy
```

Idempotent — every write is an upsert keyed on slug or email, and existing
records keep their edits. The client owns this data through the admin UI from
day one, so a second run must never overwrite their work.

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
