# RULES — Sistem KGB-KP Pegawai

> Part of `danns-plan` spec. Parent: [[SPEC]]. Siblings: [[PRD]], [[ARCHITECTURE]], [[DESIGN]], [[SCHEMA]].

## 1. Conventions & Style Baseline
- **Standard:** TypeScript `strict:true` + ESLint `next/core-web-vitals` + Prettier (printWidth 100, singleQuote, semi).
- **Formatter/Linter:** `prettier --check` + `eslint --max-warnings 0` — dijalankan di pre-commit & CI.
- **Type:** Tidak ada `any` tanpa `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- alasan`.
- **Repo layout:** **Single repo** (monolith). Cross-package rules: hanya boleh import dari `lib/` dan `components/`; dilarang import antar route `app/(dashboard)/**` (hindari coupling). `prisma/` adalah source of truth schema — jangan duplikasi type.
- **Env:** `zod` untuk validasi `process.env` di `lib/env.ts` (SMTP, CRON_SECRET, WEBHOOK_URL gagal start jika invalid).

## 2. Structure & Naming
- **Naming:** File `kebab-case.tsx` (`due-table.tsx`, `credit.ts`); Component `PascalCase` (`DueTable`); function/var `camelCase` (`forecastCredit`); DB `snake_case` (`tmt_kgb`) via `@map`; Prisma enum `PascalCase` value `snake_lower` di DB; constant `UPPER_SNAKE`.
- **Forbidden:** `global` mutable, circular import, `console.log` di prod (pakai `lib/logger.ts`), raw SQL selain via Prisma (`$queryRaw` hanya untuk agregasi yang tidak bisa Prisma), `any`, `ts-ignore` tanpa alasan.
- **Import order:** builtin → external → internal (`@/lib`, `@/components`) — enforced via `eslint-plugin-import`.
- **Error handling:** Semua Route Handler return `{error: string}` dengan status HTTP eksplisit; tidak ada throw tanpa catch di cron.

## 3. Testing & CI
- **Required tiers:** 
  - **Unit (wajib):** `lib/schedule.test.ts` (KGB+2y, KP struktural+4y, edge leap year) & `lib/credit.test.ts` (12.5/25, threshold crossing, forecast H-60, reset 0) — coverage min **70%** untuk `lib/`.
  - **Integration (wajib):** `api/cron/daily` & `api/cron/yearly` + `api/import` (happy path + baris gagal).
  - **E2E:** Tidak wajib di v1 (deferred).
- **CI gate (blocks merge ke `main`):** `npm run lint` + `tsc --noEmit` + `npm test` + `prisma validate` — semua harus hijau. GitHub Actions (atau GitLab CI di VPS) menjalankan ini per PR.
- **Pre-commit:** Husky + lint-staged: `prettier --write` + `eslint --fix` pada staged files; commit ditolak jika typecheck gagal.

## 4. Human Contributor Boundaries
- **Review:** Semua perubahan via PR ke `main` + **1 approval** admin. `main` protected (no direct push, no force push).
- **Branch:** `main` (prod), `dev` (staging), `feat/*`, `fix/*`, `ai/*` untuk agent.
- **Secret ownership:** `.env` (SMTP_HOST/PORT/USER/PASS, CRON_SECRET, WEBHOOK_SECRET, NEXTAUTH_SECRET) hanya di VPS `/opt/kgb-kp/.env` (chmod 600), tidak pernah commit. `.env.example` commit sebagai template tanpa value.
- **Deploy:** Manual `ssh → git pull → docker compose up -d --build` (bukan auto-deploy). Backup DB dulu sebelum migrate prod.
- **Dokumentasi wajib saat:** Ubah logic jadwal/kredit (update `lib/schedule` JSDoc + `PRD.md`/`SCHEMA.md`), tambah kolom/table (update `SCHEMA.md` + Prisma), ubah flow email/webhook (update `ARCHITECTURE.md`).

## 5. AI-Agent Boundaries
**FORBIDDEN without explicit approval:**
- `git push --force` / `--no-verify` / push langsung ke `main`
- `rm -rf`, `docker system prune`, `prisma migrate reset`, `DROP TABLE` / `DELETE without WHERE`
- Edit `.env` / secret, ubah `docker-compose.yml` / `nginx.conf` tanpa review
- Merge PR sendiri, bypass CI

**ALLOWED:**
- Edit file di `app/`, `components/`, `lib/`, `prisma/`, `templates/` di branch `ai/*`
- Jalankan `npm run lint`, `tsc --noEmit`, `npm test`, `prisma generate` secara lokal
- Buat PR dengan deskripsi + checklist CI; update docs terkait

**WHY (rationale):** VPS kantor adalah prod single-host — kesalahan `migrate reset` atau `rm -rf` bisa hilangkan data 100 pegawai + history. Larangan `push --force` mencegah hilangnya riwayat kenaikan. AI diberi kebebasan di branch kerja agar cepat iterasi, tapi gate CI + human approval mencegah regresi logic kritis (KGB/KP miscalculate = pegawai telat 2 tahun).

**Agent workflow:**
1. Buat branch `ai/<task>` dari `dev`
2. Edit + `npm run lint && tsc --noEmit && npm test`
3. Commit dengan pesan konvensional (`feat:`, `fix:`, `docs:`)
4. Push branch + buka PR ke `dev` (bukan `main`)
5. Tunggu CI hijau + human review
