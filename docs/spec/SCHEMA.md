# SCHEMA — Sistem KGB-KP Pegawai

> Part of `danns-plan` spec. Parent: [[SPEC]]. Siblings: [[PRD]], [[ARCHITECTURE]], [[DESIGN]], [[RULES]].
> Notation: DB-agnostic (`table / column / type / PK / FK / Notes`); examples use PostgreSQL 16 + Prisma (from [[ARCHITECTURE]]).

## 1. Tables
### `pangkat` — master golongan & threshold kredit
| Column | Type | Null? | Default | Key | Notes |
|--------|------|-------|---------|-----|-------|
| id | uuid | no | gen_random_uuid() | PK |  |
| kode | varchar(10) | no | — | UNIQUE | cth "3A", "3B", "4E" |
| nama | varchar(50) | no | — |  | "Penata Muda", "Pembina" |
| golongan | varchar(5) | no | — |  | "III", "IV" |
| level | smallint | no | — |  | urutan numerik untuk ordering |
| threshold_next | decimal(5,1) | yes | null | CHECK >0 | kredit untuk naik ke pangkat berikutnya; null=puncak |
| urutan | smallint | no | — | UNIQUE | 1..N untuk next lookup |
| created_at | timestamptz | no | now() |  |  |
| updated_at | timestamptz | no | now() |  |  |

*Seed contoh:* 3A→3B 100, 3B→3C 100, 3C→3D 150, 3D→4A 150, dst — admin bisa edit threshold_next tanpa deploy.

### `pegawai`
| Column | Type | Null? | Default | Key | Notes |
|--------|------|-------|---------|-----|-------|
| id | uuid | no | gen_random_uuid() | PK |  |
| nip | varchar(18) | no | — | UNIQUE | NIP 18 digit |
| nama | varchar(100) | no | — |  |  |
| email | varchar(255) | no | — | UNIQUE | untuk reminder |
| pangkat_id | uuid | no | — | FK→pangkat(id) RESTRICT | pangkat saat ini |
| jenis | enum('struktural','fungsional_muda','fungsional_biasa') | no | — |  | rate kredit: 0 / 25 / 12.5 |
| tmt_kgb | date | no | — | INDEX | TMT KGB terakhir |
| tmt_kp | date | no | — | INDEX | TMT KP terakhir |
| kredit | decimal(5,1) | no | 0.0 | CHECK >=0 | akumulasi kredit fungsional |
| status | enum('aktif','nonaktif') | no | 'aktif' | INDEX | soft-delete via nonaktif |
| created_at | timestamptz | no | now() |  |  |
| updated_at | timestamptz | no | now() |  |  |
| updated_by | uuid | yes | null | FK→user(id) SET NULL | audit |

### `promotion_history` — riwayat KGB/KP (audit)
| Column | Type | Null? | Default | Key | Notes |
|--------|------|-------|---------|-----|-------|
| id | uuid | no | gen_random_uuid() | PK |  |
| pegawai_id | uuid | no | — | FK→pegawai(id) CASCADE |  |
| jenis | enum('KGB','KP') | no | — |  |  |
| dari_pangkat_id | uuid | yes | null | FK→pangkat(id) SET NULL | snapshot |
| ke_pangkat_id | uuid | yes | null | FK→pangkat(id) SET NULL |  |
| dari_kredit | decimal(5,1) | yes | null |  | untuk KP fungsional |
| ke_kredit | decimal(5,1) | yes | null |  | reset 0 |
| tmt_lama | date | yes | null |  |  |
| tmt_baru | date | yes | null |  |  |
| catatan | text | yes | null |  |  |
| created_by | uuid | yes | null | FK→user(id) SET NULL | admin yang konfirmasi |
| created_at | timestamptz | no | now() | INDEX |  |

### `notification_log` — idempoten log H-60
| Column | Type | Null? | Default | Key | Notes |
|--------|------|-------|---------|-----|-------|
| id | uuid | no | gen_random_uuid() | PK |  |
| pegawai_id | uuid | no | — | FK→pegawai(id) CASCADE |  |
| type | enum('KGB','KP') | no | — |  |  |
| due_date | date | no | — |  | tanggal jatuh tempo yang diingatkan |
| channel | enum('email','webhook') | no | — |  |  |
| status | enum('sent','failed') | no | — |  |  |
| payload | jsonb | yes | null |  | snapshot data untuk debug |
| error | text | yes | null |  | jika failed |
| sent_at | timestamptz | no | now() | INDEX |  |

UNIQUE `(pegawai_id, type, due_date, channel)` — mencegah double-kirim saat cron rerun.

### `user` — auth
| Column | Type | Null? | Default | Key | Notes |
|--------|------|-------|---------|-----|-------|
| id | uuid | no | gen_random_uuid() | PK |  |
| email | varchar(255) | no | — | UNIQUE FK→pegawai(email) loose | login email |
| password_hash | varchar(255) | no | — |  | bcrypt |
| role | enum('admin','pegawai','viewer') | no | 'pegawai' |  | RBAC |
| pegawai_id | uuid | yes | null | FK→pegawai(id) SET NULL UNIQUE | link opsional 1-1 |
| created_at | timestamptz | no | now() |  |  |
| updated_at | timestamptz | no | now() |  |  |

## 2. Relations (ER)
- `pegawai.pangkat_id` → `pangkat.id` (N:1, RESTRICT) — banyak pegawai di 1 pangkat; pangkat tidak boleh dihapus jika masih dipakai.
- `promotion_history.pegawai_id` → `pegawai.id` (N:1, CASCADE) — hapus pegawai → history ikut terhapus (atau soft-delete lebih baik, jadi CASCADE jarang terpicu).
- `promotion_history.dari_pangkat_id` → `pangkat.id` (N:1, SET NULL) — snapshot, pangkat dihapus history tetap.
- `promotion_history.ke_pangkat_id` → `pangkat.id` (N:1, SET NULL)
- `notification_log.pegawai_id` → `pegawai.id` (N:1, CASCADE)
- `user.pegawai_id` → `pegawai.id` (1:1 opsional, SET NULL)
- Tidak ada N:M / junction di v1.

```
[pangkat] 1──N [pegawai] 1──N [promotion_history]
                    1──N [notification_log]
                    1──1 [user] (opsional)
```

## 3. Constraints
- **UNIQUE:** `pegawai.nip`, `pegawai.email`, `pangkat.kode`, `pangkat.urutan`, `user.email`, `(notification_log.pegawai_id, type, due_date, channel)`
- **CHECK:** `pegawai.kredit >= 0`, `pangkat.threshold_next IS NULL OR threshold_next > 0`, `pangkat.level >0`
- **FK on-delete:** `pegawai→pangkat RESTRICT`, `history→pegawai CASCADE`, `history→pangkat SET NULL`, `notif→pegawai CASCADE`, `user→pegawai SET NULL`
- **NOT NULL:** `pegawai.tmt_kgb`, `tmt_kp`, `email`, `jenis`, `pangkat_id` — wajib untuk engine jadwal.

## 4. Indexes
- `idx_pegawai_tmt_kgb` on `pegawai(tmt_kgb)` — cron & dashboard filter KGB due
- `idx_pegawai_tmt_kp` on `pegawai(tmt_kp)` — filter KP struktural
- `idx_pegawai_jenis` on `pegawai(jenis)` — filter fungsional vs struktural
- `idx_pegawai_status` on `pegawai(status)` — hanya `aktif` yang dihitung
- `idx_pegawai_pangkat` on `pegawai(pangkat_id)` — join
- `idx_history_pegawai_created` on `promotion_history(pegawai_id, created_at DESC)` — riwayat per pegawai
- `idx_notif_sent_at` on `notification_log(sent_at DESC)` — log admin
- `idx_notif_due` on `notification_log(due_date)` — idempoten lookup

## 5. Growth & Migration Notes
- **Volume:** 100 pegawai × 30 tahun dinas ≈ 15 KGB + 7 KP per orang → ~2200 `promotion_history` rows + ~3000 `notification_log` (1 per due × 2 channel). Total <10k rows — trivial untuk Postgres.
- **Retention:** Forever di v1 (tidak ada archive). Backup harian `pg_dump` cukup.
- **Soft-delete:** `pegawai.status='nonaktif'` bukan DELETE, agar FK history/notif tetap valid. Admin filter `status=aktif` di dashboard.
- **Migrations:** Prisma `migrate dev` → `migrate deploy` di Docker. Seed via `prisma/seed.ts` (100 pegawai dummy + 15 pangkat I/a–IV/e).
- **Prisma example:**
```prisma
model Pangkat {
  id             String   @id @default(uuid()) @db.Uuid
  kode           String   @unique @db.VarChar(10)
  nama           String   @db.VarChar(50)
  thresholdNext  Decimal? @map("threshold_next") @db.Decimal(5,1)
  urutan         Int      @unique
  pegawais       Pegawai[]
}
model Pegawai {
  id        String   @id @default(uuid()) @db.Uuid
  nip       String   @unique @db.VarChar(18)
  email     String   @unique @db.VarChar(255)
  pangkatId String   @map("pangkat_id") @db.Uuid
  pangkat   Pangkat  @relation(fields: [pangkatId], references: [id])
  jenis     Jenis
  tmtKgb    DateTime @map("tmt_kgb") @db.Date
  tmtKp     DateTime @map("tmt_kp") @db.Date
  kredit    Decimal  @default(0.0) @db.Decimal(5,1)
  status    Status   @default(aktif)
}
```
