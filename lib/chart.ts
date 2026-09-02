/**
 * lib/chart.ts — aggregation helpers for dashboard charts
 * Pure functions, no I/O. Used by dashboard SSR to feed Recharts.
 */
import { addYears, normalizeDate } from './schedule';
import { getFungsionalDueDate } from './credit';

export type PegawaiForChart = {
  tmtKgb: Date | string;
  tmtKp: Date | string;
  jenis: string;
  kredit: unknown;
  pangkat: { thresholdNext: unknown } | null;
};

/**
 * KGB per bulan 12 ke depan.
 * For each month starting from today (inclusive), count pegawais whose nextKgb falls in that month.
 * Returns 12 entries: [{ month: "2026-01", label: "Jan 2026", count: n }, ...]
 */
export function getKgbPerMonth(
  pegawais: PegawaiForChart[],
  today: Date | string = normalizeDate(new Date()),
): Array<{ month: string; label: string; count: number }> {
  const t = normalizeDate(today);
  const result: Array<{ month: string; label: string; count: number }> = [];

  // Build 12 month buckets
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0-11
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    result.push({ month: monthKey, label, count: 0 });
  }

  for (const p of pegawais) {
    const nextKgb = addYears(p.tmtKgb, 2);
    const y = nextKgb.getUTCFullYear();
    const m = nextKgb.getUTCMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const bucket = result.find((r) => r.month === key);
    if (bucket) bucket.count += 1;
  }

  return result;
}

/**
 * KP by jenis — proporsi due KP (struktural vs fungsional_muda vs fungsional_biasa)
 * Only counts pegawais whose KP is due within 60 days OR whose next KP falls within next 12 months?
 * Spec says "proporsi due KP struktural vs fungsional" — we count those due in 60 days (isDueIn60)
 * For Donut insight, we count KP due in 60 days grouped by jenis.
 * If no one due, returns all zero counts for completeness.
 */
export function getKpByJenis(
  pegawais: PegawaiForChart[],
  today: Date | string = normalizeDate(new Date()),
): Array<{ jenis: string; label: string; count: number; color: string }> {
  const t = normalizeDate(today);
  // Use same due logic as dashboard: isDueIn60 for struktural, isFungsionalDueIn60 for fungsional
  // Import dynamically to avoid circular? Use inline logic
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  function daysUntil(due: Date, todayDate: Date): number {
    const dueNorm = normalizeDate(due);
    const tNorm = normalizeDate(todayDate);
    return Math.round((dueNorm.getTime() - tNorm.getTime()) / MS_PER_DAY);
  }
  function isDueIn60(due: Date, todayDate: Date): boolean {
    const diff = daysUntil(due, todayDate);
    return diff >= 0 && diff <= 60;
  }

  const counts: Record<string, number> = {
    struktural: 0,
    fungsional_muda: 0,
    fungsional_biasa: 0,
  };

  for (const p of pegawais) {
    let due: Date | null = null;
    if (p.jenis === 'struktural') {
      due = addYears(p.tmtKp, 4);
      if (due && isDueIn60(due, t)) {
        counts[p.jenis] = (counts[p.jenis] ?? 0) + 1;
      }
    } else {
      // fungsional: forecast crossing -> due = next Jan 1
      const threshold = p.pangkat?.thresholdNext ?? null;
      due = getFungsionalDueDate(p.kredit as never, p.jenis, threshold as never, t);
      if (due && isDueIn60(due, t)) {
        counts[p.jenis] = (counts[p.jenis] ?? 0) + 1;
      }
    }
  }

  const labels: Record<string, string> = {
    struktural: 'Struktural',
    fungsional_muda: 'Fungsional Muda',
    fungsional_biasa: 'Fungsional Biasa',
  };
  const colors: Record<string, string> = {
    struktural: '#2563EB',
    fungsional_muda: '#16A34A',
    fungsional_biasa: '#F59E0B',
  };

  return Object.entries(counts).map(([jenis, count]) => ({
    jenis,
    label: labels[jenis] ?? jenis,
    count,
    color: colors[jenis] ?? '#64748B',
  }));
}

/**
 * Helper for bar chart: get month index for a due date relative to today
 */
export function monthDiff(dueDate: Date | string, today: Date | string = normalizeDate(new Date())): number {
  const due = normalizeDate(dueDate);
  const t = normalizeDate(today);
  return (due.getUTCFullYear() - t.getUTCFullYear()) * 12 + (due.getUTCMonth() - t.getUTCMonth());
}
