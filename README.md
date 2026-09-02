# Ritme

<p>
  <img src="public/ritme-logo.svg" alt="Ritme — KGB · KP · Tepat Waktu" width="220" />
</p>

> **Ritme** — pengingat & pencatatan KGB (2 tahun) dan KP (struktural 4 tahun / fungsional kredit 12.5–25) — Next.js + Prisma + Postgres — VPS kantor. Ritme menjaga “ritme” kenaikan berkala agar tidak ada yang terlewat: jadwal dihitung otomatis, dashboard H-60, email + webhook, dan riwayat terpusat.

**Spec:** lihat `docs/spec/SPEC.md` (single source of truth) + 5 leaf PRD/ARCH/DESIGN/SCHEMA/RULES.

**Nama sebelumnya:** Sistem KGB-KP Pegawai. Rebrand ke **Ritme** — lihat logo di `public/ritme-logo.svg` / `public/ritme-icon.svg` dan komponen `components/brand/`.

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

## Logo

- `public/ritme-icon.svg` — mark 40×40 (bulat biru #2563EB + cincin ritme putus + gelombang pulse)
- `public/ritme-logo.svg` — lockup horizontal (mark + wordmark Ritme + tagline KGB · KP · TEPAT WAKTU)
- `components/brand/ritme-mark.tsx` / `components/brand/ritme-logo.tsx` — komponen React

Makna: cincin putus = siklus periodik (2y KGB / 4y KP), gelombang = detak/ritme pengingat, titik = jatuh tempo H-60.

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
