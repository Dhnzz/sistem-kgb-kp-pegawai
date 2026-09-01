# ARCHITECTURE — Sistem KGB-KP Pegawai

> Part of `danns-plan` spec. Parent: [[SPEC]]. Siblings: [[PRD]], [[DESIGN]], [[SCHEMA]], [[RULES]].

## 1. Tech Stack
| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend + Backend | **Next.js 14+ (App Router, TypeScript)** monolith | 1 container, Server Actions + Route Handlers, SSR untuk dashboard |
| UI | Tailwind CSS + shadcn/ui | Token-based, konsisten dengan DESIGN.md |
| Auth | **NextAuth.js v5 (Credentials, JWT)** | RBAC middleware: admin / pegawai / viewer |
| ORM | **Prisma 5** | Type-safe, migration, seed |
| Data | **PostgreSQL 16** | `timestamptz` + date arithmetic presisi untuk +2y/+4y |
| Email | **Nodemailer** + SMTP configurable | ENV: SMTP_HOST/PORT/USER/PASS/SECURE/FROM; log + preview di dev |
| Webhook | Native `fetch` + HMAC-SHA256 | POST JSON ke URL configurable, header `X-Signature` |
| Excel | `exceljs` | Generate template + parse import, validasi baris |
| Cron (VPS) | `systemd timer` → `curl /api/cron/daily` + `/api/cron/yearly` | Idempoten, timezone Asia/Jakarta; fallback `node-cron` in-process untuk dev |
| Deploy | **Docker Compose** (app + postgres + nginx + certbot) | `docker compose up -d` di VPS kantor; single host |
| Backup | `pg_dump` cron 02:00 WIB + rotasi 7 hari | Volume mount `/backups` |
| Observability | `notification_log` + `promotion_history` + stdout JSON logs | Tanpa APM eksternal di v1 |

## 2. Folder / Module Structure
```
/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx        # overview KGB/KP 60 hari
│   │   ├── pegawai/page.tsx          # CRUD + import
│   │   ├── pegawai/[id]/page.tsx
│   │   ├── rekap/page.tsx            # filter due, export
│   │   └── riwayat/page.tsx          # promotion_history
│   └── api/
│       ├── pegawai/route.ts
│       ├── pangkat/route.ts
│       ├── import/route.ts
│       ├── cron/daily/route.ts       # H-60 reminder
│       └── cron/yearly/route.ts      # 1 Jan kredit + auto-promote
├── components/
│   ├── ui/ (shadcn: button, table, dialog, badge)
│   ├── pegawai/ PegawaiForm, PegawaiTable, ImportDialog
│   └── dashboard/ DueCard, DueTable, HistoryTable
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── notification/
│   │   ├── email.ts      # sendEmail(to, subject, html)
│   │   ├── webhook.ts    # dispatchWebhook(payload, secret)
│   │   └── index.ts      # sendNotification(pegawai, type) → email+webhook+log
│   ├── schedule.ts       # nextKGB(tmtKGB), nextKPStruktural(tmtKP), isDueIn60(date)
│   └── credit.ts         # forecastCredit(pegawai, today), thresholdForNext(pegawai)
├── jobs/
│   ├── dailyReminder.ts  # query dueIn60 (incl. forecast) → sendNotification
│   └── yearlyCredit.ts   # 1 Jan: kredit+=rate, check threshold → promote + log
├── prisma/
│   ├── schema.prisma
│   └── seed.ts           # 100 pegawai dummy + master pangkat
├── templates/
│   └── import-template.xlsx
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

**Pembagian shared vs domain-specific:**
- **Shared domain logic:** `lib/schedule.ts` & `lib/credit.ts` adalah pure functions (tanpa I/O) dipakai baik oleh dashboard (SSR) maupun cron — anti duplikasi formula.
- **Shared infra:** `lib/notification/` abstract `send()` sehingga v2 tinggal tambah `wa.ts` tanpa ubah caller.
- **Domain-specific:** `components/pegawai`, `app/api/pegawai` hanya untuk entitas pegawai; `app/api/pangkat` untuk master pangkat.

## 3. Data Flow
**Primary request lifecycle:**

1. **CRUD Pegawai (admin):** Browser → Server Action (`app/api/pegawai`) → Prisma validate (NIP unique, pangkat FK) → Postgres → revalidate `dashboard` + `pegawai` cache → response.
2. **Dashboard view:** SSR `dashboard/page.tsx` → Prisma query `pegawai` + `promotion_history` → `lib/schedule` + `lib/credit` hitung `nextDue` & `forecastDue` → render DueTable / DueCard.
3. **Cron harian 07:00 WIB:** `systemd timer` → `GET /api/cron/daily` (Bearer CRON_SECRET) → `jobs/dailyReminder`:
   - Load semua pegawai aktif + master pangkat.
   - Untuk tiap pegawai hitung `dueDate`:
     - KGB: `tmt_kgb + 2y`
     - KP struktural: `tmt_kp + 4y`
     - KP fungsional: jika `forecastCredit(1 Jan berikutnya) >= threshold_next` maka `dueDate = 1 Jan berikutnya` (tahun depan) else `null` (belum due).
   - Filter `dueDate between today AND today+60` → `dueIn60` set.
   - Untuk tiap `due` → `sendNotification` (email + webhook) → tulis `notification_log` dengan unique `(pegawai_id, type, due_date)` untuk idempoten → `Promise.allSettled` + retry 1x jika failed.
4. **Cron tahunan 1 Jan 00:05 WIB:** `GET /api/cron/yearly` → `jobs/yearlyCredit`:
   - Batch `UPDATE pegawai SET kredit = kredit + rate` where jenis fungsional.
   - Loop cek `kredit >= threshold_next` → `UPDATE pangkat = next, kredit=0`, insert `promotion_history`, kirim email promosi.

**Service boundaries:**
- **Sync:** CRUD, dashboard SSR, export — langsung ke DB (Postgres) tanpa queue.
- **Async in-process:** Email/webhook dispatch via `Promise.allSettled` (bukan job queue eksternal). Alasan: 100 pegawai = max ~20 email/hari, tidak butuh Redis/BullMQ di v1.
- **Idempoten:** `notification_log` unique constraint mencegah double-kirim jika cron rerun; `promotion_history` mencegah double-promote.

## 4. Technical Decisions (ADR-style)
### D-ARCH-01 — Monolith Next.js (bukan microservice / Laravel terpisah)
- **Status:** accepted
- **Context:** 100 pegawai, 1 VPS kantor, tim kecil, butuh CRUD + cron + email cepat jadi.
- **Decision:** Satu Next.js monolith (frontend+backend) + Prisma + Postgres dalam 1 Docker Compose.
- **Consequences:** Deploy simpel (`git pull && compose up`), latency rendah (tanpa hop antar service). Trade-off: jika scale >5k atau butuh SIASN microservice, perlu extract `jobs` ke worker terpisah. Alternatif Laravel ditolak karena type-safety Prisma & DX Next.js lebih baik untuk webhook/cron modern; microservice ditolak karena overkill.

### D-ARCH-02 — PostgreSQL + Prisma (bukan MySQL + Sequelize)
- **Status:** accepted
- **Context:** Logic tanggal presisi (+2y/+4y tepat, forecast 1 Jan) dan kredit desimal 12.5.
- **Decision:** Postgres `timestamptz` + `interval` arithmetic, Prisma untuk migration & type generation.
- **Consequences:** Query `tmt_kgb + interval '2 years'` akurat; Prisma Client type-safe mencegah salah field. Alternatif MySQL ditolak: date arithmetic kurang ekspresif & `DECIMAL` handling kurang nyaman.

### D-ARCH-03 — Cron via systemd timer → HTTP endpoint (bukan Vercel Cron / pg_cron)
- **Status:** accepted
- **Context:** VPS on-prem, tidak di Vercel, butuh reliable 07:00 WIB & 1 Jan 00:05.
- **Decision:** `systemd timer` di host memanggil `curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/*`.
- **Consequences:** Visible di `systemctl`, log di journal, idempoten via DB constraint. Alternatif `node-cron` in-process ditolak sebagai primary karena mati jika app restart; `pg_cron` ditolak karena butuh extension & kurang fleksibel untuk email/webhook.

### D-ARCH-04 — Async in-process (Promise.allSettled) tanpa Redis queue
- **Status:** accepted
- **Context:** Volume email kecil (<25/hari), ingin hindari infra tambahan di VPS.
- **Decision:** Kirim email/webhook paralel dengan `allSettled`, log hasil, retry 1x synchronous; tidak pakai BullMQ/Redis di v1.
- **Consequences:** Zero infra tambahan, cukup untuk SLA 95%. Trade-off: jika SMTP lambat, request cron bisa 10-20s; masih OK untuk job harian. Alternatif Redis queue ditolak sebagai premature optimization; akan diadopsi di v2 jika WA + H-30/H-7 menambah volume.

### D-ARCH-05 — Webhook HMAC sebagai extension point (bukan WA native di v1)
- **Status:** accepted
- **Context:** Butuh jalur integrasi future (WA gateway, n8n) tanpa ubah core.
- **Decision:** Setiap `sendNotification` selain email juga `POST JSON {pegawai, type, dueDate}` ke `WEBHOOK_URL` (jika set) dengan `X-Signature: hmac_sha256(body, WEBHOOK_SECRET)`.
- **Consequences:** v2 WA tinggal pasang gateway yang verify HMAC, tanpa deploy ulang core. Alternatif WA langsung di v1 ditolak karena butuh vendor & scope creep.
