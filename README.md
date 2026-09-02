# Sistem KGB-KP Pegawai

> Pengingat & pencatatan KGB (2 tahun) dan KP (struktural 4 tahun / fungsional kredit 12.5–25) — Next.js + Prisma + Postgres — VPS kantor

**Spec:** lihat `docs/spec/SPEC.md` (single source of truth) + 5 leaf PRD/ARCH/DESIGN/SCHEMA/RULES.

**Tickets:** `.scratch/sistem-kgb-kp-pegawai/issues/` (8 vertical slices) — frontier: T1

## Quick start (setelah T1)

```bash
cp .env.example .env
# edit DATABASE_URL, NEXTAUTH_SECRET, CRON_SECRET
docker compose up -d
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
# http://localhost:3000
```

Seed default:
- Admin: `admin@example.com` / `Admin123!`
- Pegawai: `pegawai1@example.com` … `pegawai5@example.com` / `pegawai123`
- 17 pangkat I/a–IV/e + 100 pegawai dummy

## Prisma

```bash
npx prisma generate
npx prisma migrate dev
npx prisma studio
npx prisma validate
```

## Cron

```bash
# Harian H-60 07:00 WIB
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
# Tahunan 1 Jan 00:05
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/yearly
```

## Checks

```bash
npm run lint
npm run typecheck
npm test
npx prisma validate
```
