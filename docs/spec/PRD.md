# PRD — Sistem KGB-KP Pegawai

> Part of `danns-plan` spec. Parent: [[SPEC]]. Siblings: [[ARCHITECTURE]], [[DESIGN]], [[SCHEMA]], [[RULES]].

## 1. Problem & Users
**Problem:** Admin kepegawaian memantau ±100 pegawai secara manual via Excel untuk jadwal Kenaikan Gaji Berkala (KGB) tiap 2 tahun dan Kenaikan Pangkat (KP) tiap 4 tahun (struktural) atau berbasis kredit tahunan (fungsional). Rawan terlewat, tidak ada pengingat otomatis, data tercecer, dan pegawai sering telat menyiapkan berkas.

**Primary users:**
- **Admin Kepegawaian** — kelola data pegawai, pantau jadwal, terima rekap reminder, persiapkan administrasi.
- **Pegawai** — lihat jadwal KGB/KP sendiri, terima email pengingat H-60.

**Secondary / viewer:**
- **Pimpinan / Auditor** — lihat dashboard & riwayat kenaikan (read-only).

**Non-users / out of scope audience:** Bagian keuangan/penggajian (sistem ini bukan payroll), BKN/SIASN operator (tidak integrasi di v1).

## 2. Goals
- G1: **0 pegawai terlewat** — 100% reminder KGB/KP terkirim tepat H-60 hari sebelum jatuh tempo (prediksi termasuk kredit Januari untuk KP fungsional).
- G2: **Visibility 10 detik** — admin dapat melihat dalam <10 detik siapa yang akan KGB/KP bulan ini & 2 bulan ke depan via dashboard.
- G3: **Single source of truth** — data TMT KGB/KP, golongan, kredit menjadi sumber tunggal menggantikan Excel; riwayat kenaikan tercatat permanen.

## 3. Non-Goals
- NG1: Bukan sistem penggajian — hanya jadwal KGB, tidak menghitung nominal rupiah gaji.
- NG2: Bukan SIASN/BKN sync — tidak ada integrasi eksternal ke BKN di v1.
- NG3: Bukan workflow approval berjenjang — v1 cukup admin kelola, pegawai lihat. Approval atasan deferred ke v2.
- NG4: Bukan mobile native app — v1 web responsive saja.
- NG5 (dari Q2): Tidak menangani cetak SK di v1; hanya pengingat & pencatatan. Template cetak di v2.

## 4. Scope
**In scope (v1):**
- CRUD pegawai + master pangkat/golongan dengan threshold kredit per jenjang.
- Import bulk dari Excel + template import + seeder untuk testing (100 pegawai).
- Hitung jadwal KGB (TMT KGB terakhir + 2 tahun tepat) dan KP struktural (TMT KP + 4 tahun).
- Hitung & proyeksi kredit KP fungsional (12.5 / 25 per 1 Januari, threshold per pangkat, reset 0 saat naik).
- Dashboard daftar akan KGB/KP (bulan ini, next 60 hari, lewat).
- Cron harian: email reminder H-60 ke pegawai + rekap ke admin; webhook dispatch (opsional, configurable) untuk integrasi lanjutan (WA gateway / n8n).
- Riwayat / log kenaikan (siapa, kapan, dari→ke, jenis KGB/KP) — searchable.
- Auth & role: admin (full) vs pegawai (read own) vs viewer.
- Export rekap (Excel/CSV).

**Out of scope:** Cetak SK/template administrasi (v2), WhatsApp native (v2), notifikasi H-30/H-7 berjenjang (v2), SIASN sync, payroll.

## 5. MVP
**Fitur wajib agar usable:**
- M1: CRUD pegawai (NIP, nama, email, golongan/pangkat saat ini, TMT KGB terakhir, TMT KP terakhir, jenis: struktural / fungsional_muda / fungsional_biasa, kredit_terkini) + master pangkat (kode, nama, threshold_kredit_next) + import Excel dengan template + seeder 100 data dummy.
- M2: Engine jadwal — KGB = +2y, KP struktural = +4y, KP fungsional = proyeksi kredit 1 Januari berikutnya vs threshold pangkat tujuan; tentukan `next_due_date` & `is_due_in_60_days`.
- M3: Dashboard — tabel/filter: akan KGB 60 hari, akan KP 60 hari, riwayat kenaikan; badge status (aman/mendekati/lewat).
- M4: Notifikasi — cron harian 07:00 WIB: kirim email ke pegawai yang `due_in_60_days` + 1 email rekap ke admin; dispatch webhook POST (jika dikonfigurasi) dengan payload JSON yang sama; log pengiriman (sent/failed) + retry 1x.
- M5: Riwayat kenaikan — tabel `promotion_history` mencatat setiap kenaikan terealisasi; admin dapat trigger "konfirmasi naik" atau sistem auto-apply saat `credit >= threshold` di 1 Januari / tanggal jatuh tempo tiba.
- M6: Auth & RBAC — login email+password, role admin/pegawai/viewer, pegawai hanya lihat data sendiri.

**Deferred (v2+):**
- WhatsApp reminder via gateway.
- Template administrasi cetak (surat pengantar KGB/KP).
- Notifikasi berjenjang H-30 & H-7 (tambahan di atas H-60).
- Approval workflow & e-sign.
- SIASN/BKN integration.

## 6. Technical Requirements
- TR1: Scale 100 pegawai aktif (desain tahan 1000), VPS kantor on-prem, single instance cukup; backup harian DB.
- TR2: Email via SMTP configurable (host/port/user/pass/TLS) + log + preview di dev; webhook URL configurable (optional, HMAC signature).
- TR3: Cron reliable — job harian idempoten, tidak double-kirim jika rerun; timezone Asia/Jakarta.
- TR4: Import Excel — validasi NIP unik, email valid, TMT valid, pangkat ada di master; laporkan baris gagal.
- TR5: Time precision — KGB/KP jatuh tempo dihitung tanggal tepat (tanpa toleransi), kredit fungsional ditambah tepat 1 Jan 00:00 WIB via cron terpisah.
- TR6: Auditability — setiap perubahan TMT/kredit/pangkat tercatat `updated_by` + timestamp.

## 7. Success Metrics
| Metric | Target | Window |
|--------|--------|--------|
| Email delivery rate (terkirim tanpa bounce) | >=95% | per bulan |
| Jadwal miscalculate vs hitung manual | <1% | per quarter |
| Admin time-to-find "siapa bulan depan" | <30 detik | per sesi |
| Import 100 baris Excel sukses | <60 detik | per import |
| Zero missed reminder (due_in_60 tapi tidak terkirim) | 0 kasus | per bulan |

## 8. Decisions (rationale seeds for SPEC Decision Log)
- D-PRD-01: Flat threshold awal ditolak → threshold per pangkat configurable di master pangkat (karena tiap jenjang beda, cth 3B→3C 100, 3C→3D 150). Alternatif flat 100 ditolak karena tidak akurat.
- D-PRD-02: Kredit reset ke 0 saat naik (bukan carryover sisa) — sesuai contoh Q10; alternatif carryover ditolak untuk konsistensi aturan instansi.
- D-PRD-03: Prediksi H-60 untuk fungsional = forecast kredit 1 Januari berikutnya vs threshold, bukan kredit hari ini saja. Alternatif cek kredit real-time ditolak karena telat 2 bulan.
- D-PRD-04: Webhook ditambahkan di samping email (bukan pengganti) untuk future WA/n8n tanpa ubah core; email tetap primary channel v1.
- D-PRD-05: Riwayat kenaikan masuk MVP (bukan v2) karena diminta eksplisit Q6 — audit & akuntabilitas.
- D-PRD-06: KGB tetap +2y strict tanpa penundaan otomatis; penundaan via edit manual admin (Q10 cuti/hukuman).
