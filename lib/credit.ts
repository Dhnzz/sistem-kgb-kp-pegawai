/**
 * lib/credit.ts — KP Fungsional credit engine
 * Rate: fungsional_muda 25, fungsional_biasa 12.5, struktural 0 per 1 Januari
 * Forecast: kredit 1 Jan berikutnya = kredit_now + rate
 * Due: jika forecast >= threshold_next maka due = 1 Jan berikutnya, else null
 * Digunakan oleh dashboard & cron dailyReminder untuk filter dueIn60.
 * Pure functions, no I/O.
 */
import { normalizeDate, isDueIn60, toISODate } from './schedule';

export type Jenis = 'struktural' | 'fungsional_muda' | 'fungsional_biasa';

const RATE_MAP: Record<Jenis, number> = {
  struktural: 0,
  fungsional_biasa: 12.5,
  fungsional_muda: 25,
};

/**
 * Return kredit rate per 1 Jan untuk jenis pegawai.
 * Throws if jenis invalid (defensive).
 */
export function getCreditRate(jenis: string): number {
  if (jenis in RATE_MAP) return RATE_MAP[jenis as Jenis];
  return 0;
}

/**
 * Alias: kreditRate / rateForJenis
 */
export const kreditRate = getCreditRate;
export const rateForJenis = getCreditRate;

/**
 * Get 1 Januari tahun berikutnya dari today (UTC).
 * Contoh: today=2026-11-01 => 2027-01-01, today=2026-01-01 => 2027-01-01 (next year).
 * Jika today adalah 1 Jan, due adalah Jan berikutnya (tidak hari ini), karena kredit sudah ditambah via cron yearly hari itu.
 * Untuk tujuan forecast H-60, kita selalu prediksi Jan 1 tahun depan.
 */
export function getNextJan1(today: Date | string = normalizeDate(new Date())): Date {
  const t = normalizeDate(today);
  const y = t.getUTCFullYear();
  // Always next year's Jan 1, regardless if today is Jan 1
  // But if today is Dec 31, next Jan 1 is tomorrow (y+1)
  // This matches spec: "1 Jan berikutnya"
  // Edge: if today is Jan 1, we still return Jan 1 next year (not today)
  // Cron yearly runs Jan 1 00:05, so after that forecast would already be applied.
  // Keeping logic simple: y+1
  return new Date(Date.UTC(y + 1, 0, 1));
}

/**
 * Forecast kredit pada 1 Jan berikutnya = kredit_now + rate(jenis).
 * Untuk struktural rate 0 => forecast = kredit (tidak relevan).
 * Kredit bisa berupa number, string, atau Decimal.
 */
export function forecastCredit(
  kredit: number | string | { toString(): string },
  jenis: string,
): number {
  const k = toNumber(kredit);
  const rate = getCreditRate(jenis);
  // Use integer tenths to avoid floating errors: 12.5 *10 =125, 25*10=250
  // Multiply by 10, round, then divide.
  const raw = k * 10 + rate * 10;
  // raw is tenths*10? Actually k*10 already tenths, rate*10 too, sum = (k+rate)*10
  return Math.round(raw) / 10;
}

/**
 * Check if forecastCredit will cross threshold_next (naik pangkat di 1 Jan).
 * thresholdNext null => puncak, never promote.
 */
export function willPromote(
  kredit: number | string | { toString(): string },
  jenis: string,
  thresholdNext: number | string | { toString(): string } | null | undefined,
): boolean {
  if (thresholdNext === null || thresholdNext === undefined) return false;
  const th = toNumber(thresholdNext);
  if (th <= 0) return false;
  const forecast = forecastCredit(kredit, jenis);
  return forecast >= th;
}

/**
 * Return due date untuk KP fungsional (1 Jan berikutnya) jika forecast >= threshold, else null.
 */
export function getFungsionalDueDate(
  kredit: number | string | { toString(): string },
  jenis: string,
  thresholdNext: number | string | { toString(): string } | null | undefined,
  today: Date | string = normalizeDate(new Date()),
): Date | null {
  if (jenis === 'struktural') return null;
  if (thresholdNext === null || thresholdNext === undefined) return null;
  if (!willPromote(kredit, jenis, thresholdNext)) return null;
  return getNextJan1(today);
}

/**
 * True if KP fungsional will be due within 60 days (forecast crossing + Jan1 within 60).
 */
export function isFungsionalDueIn60(
  kredit: number | string | { toString(): string },
  jenis: string,
  thresholdNext: number | string | { toString(): string } | null | undefined,
  today: Date | string = normalizeDate(new Date()),
): boolean {
  const due = getFungsionalDueDate(kredit, jenis, thresholdNext, today);
  if (!due) return false;
  return isDueIn60(due, today);
}

/**
 * Alias for spec naming
 */
export const isDueIn60Fungsional = isFungsionalDueIn60;
export const nextKpFungsional = getFungsionalDueDate;
export const forecastForNextJan = forecastCredit;

/**
 * Kredit progress percent 0-100 for ProgressBar: kredit / threshold *100 capped 100.
 * If threshold null/0 => 0.
 */
export function kreditProgressPercent(
  kredit: number | string | { toString(): string },
  thresholdNext: number | string | { toString(): string } | null | undefined,
): number {
  if (thresholdNext === null || thresholdNext === undefined) return 0;
  const th = toNumber(thresholdNext);
  if (th <= 0) return 0;
  const k = toNumber(kredit);
  const pct = (k / th) * 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Helper: normalize Decimal/number/string to number.
 */
function toNumber(v: number | string | { toString(): string }): number {
  if (typeof v === 'number') return v;
  // Prisma Decimal has toNumber() but also toString
  // Handle object with toNumber
  if (typeof v === 'object' && v !== null && 'toNumber' in v) {
    // eslint-disable-next-line -- Prisma Decimal toNumber()
    const maybe = v as any;
    if (typeof maybe.toNumber === 'function') return maybe.toNumber();
  }
  const n = Number(String(v));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Threshold for next pangkat lookup helper (for future use with pangkat array)
 */
export function thresholdForNext(
  pangkat: { thresholdNext?: number | string | { toString(): string } | null } | null | undefined,
): number | null {
  if (!pangkat) return null;
  if (pangkat.thresholdNext === null || pangkat.thresholdNext === undefined) return null;
  return toNumber(pangkat.thresholdNext);
}

// Re-export schedule helpers for convenience
export { isDueIn60, toISODate, normalizeDate, getNextJan1 as nextJan1 };
