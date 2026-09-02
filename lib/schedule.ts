/**
 * lib/schedule.ts — Pure schedule engine for KGB & KP Struktural
 * - KGB: +2 years exact from TMT KGB
 * - KP struktural: +4 years exact from TMT KP
 * - isDueIn60: dueDate ∈ [today, today+60] inclusive
 * No I/O, no Prisma — used by dashboard SSR and cron jobs.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse YYYY-MM-DD string as UTC midnight without local TZ shift.
 */
function parseDateOnly(s: string): Date {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(Date.UTC(y, mo - 1, d));
  }
  // fallback: let Date parse then convert to UTC date-only
  const d = new Date(s);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Normalize any Date|string to UTC midnight (date-only).
 */
export function normalizeDate(input: Date | string): Date {
  if (typeof input === 'string') {
    return parseDateOnly(input);
  }
  // input is Date — strip time via UTC Y/M/D
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

/**
 * Return today's UTC date-only (midnight). Exported for testability.
 */
export function todayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/**
 * Add N years to a date, preserving month/day but clamping Feb 29 to Feb 28
 * when target year is not leap. Operates in UTC to avoid DST/TZ issues.
 */
export function addYears(date: Date | string, years: number): Date {
  const d = normalizeDate(date);
  const y = d.getUTCFullYear() + years;
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  // last day of target month
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return new Date(Date.UTC(y, m, clampedDay));
}

/**
 * KGB next due = TMT KGB + 2 years exact.
 */
export function nextKgb(tmtKgb: Date | string): Date {
  return addYears(tmtKgb, 2);
}

/** alias for case-insensitive import */
export const nextKGB = nextKgb;
export const nextKgbDue = nextKgb;

/**
 * KP struktural next due = TMT KP + 4 years exact.
 */
export function nextKpStruktural(tmtKp: Date | string): Date {
  return addYears(tmtKp, 4);
}

export const nextKP = nextKpStruktural;
export const nextKPStruktural = nextKpStruktural;
export const nextKp = nextKpStruktural;

/**
 * Days until due from today (due - today). Negative means overdue.
 */
export function daysUntil(dueDate: Date | string, today: Date | string = todayUTC()): number {
  const due = normalizeDate(dueDate);
  const t = normalizeDate(today);
  return Math.round((due.getTime() - t.getTime()) / MS_PER_DAY);
}

/**
 * True if dueDate is within [today, today+60] inclusive.
 * Both dates are normalized to UTC midnight.
 */
export function isDueIn60(dueDate: Date | string, today: Date | string = todayUTC()): boolean {
  const diff = daysUntil(dueDate, today);
  return diff >= 0 && diff <= 60;
}

/**
 * Alias sometimes used in specs.
 */
export const isDueIn60Days = isDueIn60;

/**
 * True if dueDate is before today (overdue).
 */
export function isOverdue(dueDate: Date | string, today: Date | string = todayUTC()): boolean {
  return daysUntil(dueDate, today) < 0;
}

/**
 * Format Date to YYYY-MM-DD (UTC).
 */
export function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
