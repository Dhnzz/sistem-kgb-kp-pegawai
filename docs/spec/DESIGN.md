# DESIGN — Sistem KGB-KP Pegawai

> Part of `danns-plan` spec. Parent: [[SPEC]]. Siblings: [[PRD]], [[ARCHITECTURE]], [[SCHEMA]], [[RULES]].

## 1. User Flows
**Persona Admin Kepegawaian (primary):**
```
Login → Dashboard (KPI: KGB 60h, KP 60h, Lewat, Total Pegawai)
      → klik KPI → Rekap/filtered DueTable (tab KGB | KP)
      → Pegawai → Table + Search + Filter jenis/pangkat → CRUD (Dialog) / Import Excel (preview → confirm)
      → Rekap → Export Excel/CSV
      → Riwayat → HistoryTable (filter jenis, rentang tanggal)
      → Log Notifikasi → status sent/failed + Resend
```

**Persona Pegawai:**
```
Login → Dashboard Mini (Card: KGB nextDue, KP nextDue + CreditProgressBar + ForecastBadge)
      → Riwayat Saya (read-only)
```

**Persona Pimpinan / Viewer:**
```
Login → Dashboard + Riwayat (read-only, tanpa tombol CRUD/Import/Resend)
```

**Flow Import Excel:**
```
Pegawai → Import → Download Template → Upload .xlsx → Preview (baris OK hijau / gagal merah + alasan)
        → Confirm → Toast "X berhasil, Y gagal" → Tabel pegawa ter-refresh
```

**Flow Konfirmasi Kenaikan Manual (admin):**
```
Dashboard DueTable → baris due → tombol "Konfirmasi Naik" → Dialog (pangkat baru, TMT baru, catatan)
                  → tulis promotion_history + update pegawai (pangkat, tmt, kredit=0) → toast sukses
```
(Otomatis yearly 1 Jan tetap jalan; manual untuk koreksi / KGB tepat tanggal)

**Edge states:**
- **Empty dashboard:** ilustrasi + CTA "Tambah Pegawai / Import Excel" jika 0 pegawai.
- **Empty due:** "Tidak ada yang jatuh tempo 60 hari ke depan 🎉".
- **Error import:** tabel baris gagal dengan alasan spesifik (NIP duplikat, email invalid, pangkat tidak ditemukan, TMT invalid).
- **Error SMTP:** badge merah "Gagal" di Log Notifikasi + tombol Resend; error detail di tooltip.
- **Offline:** Next.js offline banner + retry; form tidak submit jika offline.

## 2. Design System
- **Base:** **Tailwind CSS + shadcn/ui** (Radix primitives)
- **Tokens:**
  - **Palette:** Slate netral (bg #F8FAFC, card #FFFFFF, border #E2E8F0, text #0F172A); Accent biru #2563EB (primary/action), success #16A34A (akan naik/terkirim), warning #F59E0B (mendekati), danger #DC2626 (lewat/gagal), muted #64748B.
  - **Type:** Inter — H1 24/bold, H2 18/semibold, body 14/regular, caption 12/medium; line-height 1.5.
  - **Spacing:** 4pt scale (4,8,12,16,24,32); container max 1280px, card padding 16-24.
  - **Radius:** `0.5rem` (8px) default; `0.375rem` untuk input/badge.
  - **Shadow:** `sm` untuk card, `md` untuk dialog.
- **Theme:** **Light only** di v1; dark deferred ke v2 (token sudah siap via CSS vars shadcn).
- **Icon:** lucide-react (konsisten outline 1.5px)

## 3. Component Inventory
| Component | Reusable? | Notes |
|-----------|-----------|-------|
| Button | yes | variant default/outline/ghost/destructive; size sm/md/lg |
| Input, Select, DatePicker | yes | shadcn + react-hook-form + zod |
| Dialog / Sheet | yes | Untuk PegawaiForm, ConfirmNaik, Import preview |
| Table (TanStack Table) | yes | Sort, filter, pagination, sticky header |
| Badge | yes | Status: Akan KGB/KP (blue), Lewat (red), Terkirim (green), Gagal (red) |
| Card / KPI Card | yes | Angka besar + trend |
| Tabs | yes | KGB | KP | Semua |
| Progress (CreditProgressBar) | yes | value = kredit / threshold_next *100%, label "145/150" |
| ForecastBadge | yes | "Diprediksi naik 1 Jan 2027" kalau forecast crossing |
| Alert / Toast (sonner) | yes | Success/error feedback |
| DueCard | domain | Ringkas untuk dashboard mini pegawai |
| DueTable | domain | Tabel due 60 hari dengan aksi Konfirmasi |
| PegawaiForm | domain | Fields NIP, nama, email, golongan, TMT KGB/KP, jenis, kredit |
| PegawaiTable | domain | Admin CRUD table |
| ImportDialog | domain | Upload + preview OK/gagal |
| HistoryTable | domain | Riwayat kenaikan, filter & export |
| Chart: KGB per Bulan (Bar) | special | 1 chart: 12 bulan ke depan, hitung KGB due per bulan (Recharts) |
| Chart: KP by Jenis (Donut) | special | 2nd chart: proporsi due KP struktural vs fungsional_muda vs biasa (Recharts) |

**Chart treatment (Recharts):** ResponsiveContainer, tooltip, warna sesuai palette (biru/hijau/amber). Data dari `lib/schedule` aggregation di SSR; no heavy client calc. Defer chart ke client component dengan `dynamic(import)`.

## 4. Design-Technical Decisions
- **Responsive:** **Desktop-first** (admin di kantor) — layout sidebar + main. Breakpoints `md:768` collapse sidebar ke drawer, `lg:1024` show 4 KPI cards in row, mobile stack cards (1 col) untuk pegawai. Table horizontal scroll di mobile, DueCard sebagai fallback list.
- **A11y:** WCAG AA — shadcn/Radix sudah keyboard-navigable, focus ring visible, semantic `<table>`, `aria-label` di icon button, contrast ratio >=4.5:1 (cek palette). Form error `aria-describedby`.
- **i18n:** **Indonesia full** — semua label, header tabel, template email berbahasa Indonesia. Tidak perlu multi-bahasa di v1; string terpusat di `lib/i18n/id.ts` untuk memudahkan v2.
- **State:** Server state via Prisma SSR + revalidate; client state minimal (dialog open, filter) via useState. Tidak perlu Redux/Zustand di v1.
- **Animation:** Subtle — `transition` 150ms untuk hover/button, dialog fade. Tidak ada animasi chart berlebihan.
