# Repository Guidelines

## Project Structure & Module Organization
The Next.js app lives in `src/app` with route groups for auth and dashboard features. Reusable UI sits in `src/components` (domain folders like `chat/` and shadcn primitives under `ui/`), shared logic in `src/lib`, and types in `src/types`. The NestJS GraphQL service resides in `apps/backend`, Prisma migrations in `supabase/migrations`, and shared schema types in `packages/shared-types`. Tests mirror runtime code: Vitest units in `tests/unit` and Playwright scenarios in `tests/e2e`. Static assets go in `public/`; long-form docs stay in `docs/`.

## Build, Test, and Development Commands
Install dependencies with `pnpm install`. `pnpm dev` boots the realtime proxy plus Next.js on port 3002; `pnpm dev:next-only` skips the proxy for UI-only work. Use `pnpm build` and `pnpm start` for production smoke tests. Quality gates run through `pnpm lint`, `pnpm type-check`, and `pnpm format`. Backing services spin up with `docker-compose up -d` (tear down with `docker-compose down`) or Supabase helpers (`pnpm supabase:start`, `pnpm supabase:reset`). Regenerate GraphQL artifacts via `pnpm codegen`.

## Coding Style & Naming Conventions
Prettier 3 and the Next.js ESLint config own formatting, so run `pnpm lint --fix` when unsure. Stick to functional components exporting PascalCase identifiers while file names stay kebab-case (`calendar-view.tsx`). Co-locate hooks or helpers inside `src/lib/<feature>`, group Tailwind classes by layout → spacing → color, and avoid mixing server and client logic in a single module.

### Localization / i18n
- All user-facing strings must be pulled from `src/lib/translations.ts` via the `t()` helper; never hardcode copy directly in components.
- When adding a new phrase, add both English (`en`) and Japanese (`ja`) entries and keep the keys short but descriptive (e.g., `lostKey.title`).
- UI states should display translation keys for toasts/errors instead of raw copy so multi-language behavior stays consistent.

## Testing Guidelines
Unit coverage uses Vitest; store files as `<feature>.test.ts` inside `tests/unit/**` and prefer explicit assertions over broad snapshots. Run `pnpm test` locally, `pnpm test -u` when updating snapshots, and `pnpm test:coverage` before major refactors. Playwright flows live in `tests/e2e`; start Docker services and the backend, then execute `pnpm test:e2e` or `pnpm test:e2e --project=chromium` for browser-specific runs.

## Commit & Pull Request Guidelines
Write commit subjects under ~60 characters, present tense, imperative (`Fix Cloudflare Pages deployment`). Stage logical bundles, confirm `pnpm lint && pnpm test` pass, and sign off on generated artifacts. PRs should explain the change, link issues (`Closes #123`), note manual or automated verification, and attach screenshots for UI work. Wait for green CI and resolve feedback before merging.

## Security & Environment
Copy secrets from `.env.local.example`, keep private keys out of git, and manage per-user overrides with `direnv`. Rotate shared credentials if exposed and distribute Supabase, Groq, or OAuth tokens via secure channels only.
