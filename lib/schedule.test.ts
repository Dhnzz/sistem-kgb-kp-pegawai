import { describe, it, expect } from 'vitest';
import { addYears, nextKgb, nextKGB, nextKpStruktural, nextKP, isDueIn60, isOverdue, daysUntil, normalizeDate, toISODate } from './schedule';

describe('lib/schedule', () => {
  describe('normalizeDate', () => {
    it('parses YYYY-MM-DD string as UTC midnight', () => {
      const d = normalizeDate('2024-03-01');
      expect(d.toISOString()).toBe('2024-03-01T00:00:00.000Z');
    });
    it('strips time from Date', () => {
      const d = normalizeDate(new Date('2024-03-01T15:30:00Z'));
      expect(d.toISOString()).toBe('2024-03-01T00:00:00.000Z');
    });
  });

  describe('addYears', () => {
    it('adds 2 years for KGB case 2024-03-01 -> 2026-03-01', () => {
      expect(toISODate(addYears('2024-03-01', 2))).toBe('2026-03-01');
    });
    it('adds 4 years for KP struktural 2020-01-15 -> 2024-01-15', () => {
      expect(toISODate(addYears('2020-01-15', 4))).toBe('2024-01-15');
    });
    it('clamps Feb 29 to Feb 28 on non-leap target', () => {
      // 2020-02-29 +2 years = 2022-02-28 (2022 not leap)
      expect(toISODate(addYears('2020-02-29', 2))).toBe('2022-02-28');
      // +4 years = 2024-02-29 (2024 is leap -> keep 29)
      expect(toISODate(addYears('2020-02-29', 4))).toBe('2024-02-29');
    });
    it('handles Date input', () => {
      const d = new Date(Date.UTC(2023, 5, 15));
      expect(toISODate(addYears(d, 2))).toBe('2025-06-15');
    });
  });

  describe('nextKgb', () => {
    it('returns +2y exact', () => {
      expect(toISODate(nextKgb('2024-03-01'))).toBe('2026-03-01');
      expect(toISODate(nextKGB('2022-06-15'))).toBe('2024-06-15');
    });
    it('works with Date object', () => {
      expect(toISODate(nextKgb(new Date('2024-03-01')))).toBe('2026-03-01');
    });
  });

  describe('nextKpStruktural', () => {
    it('returns +4y exact', () => {
      expect(toISODate(nextKpStruktural('2020-01-01'))).toBe('2024-01-01');
      expect(toISODate(nextKP('2022-06-15'))).toBe('2026-06-15');
    });
  });

  describe('isDueIn60', () => {
    const today = '2026-01-01';
    it('verifiable: TMT KGB 2024-03-01 -> next 2026-03-01 is due from Jan 2026', () => {
      const next = nextKgb('2024-03-01'); // 2026-03-01
      expect(toISODate(next)).toBe('2026-03-01');
      // 2026-01-01 to 2026-03-01 = 59 days (Jan 31 + Feb 28) => within 60
      expect(isDueIn60(next, today)).toBe(true);
      expect(daysUntil(next, today)).toBe(59);
    });
    it('returns true for due today', () => {
      expect(isDueIn60('2026-01-01', today)).toBe(true);
    });
    it('returns true for due in 60 days exactly', () => {
      // Jan 1 +60 = Mar 2 (31+28=59, +1 Mar =60 -> Mar 2)
      expect(isDueIn60('2026-03-02', today)).toBe(true);
    });
    it('returns false for due in 61 days', () => {
      expect(isDueIn60('2026-03-03', today)).toBe(false);
    });
    it('returns false for overdue', () => {
      expect(isDueIn60('2025-12-31', today)).toBe(false);
    });
    it('returns false for far future', () => {
      expect(isDueIn60('2026-06-01', today)).toBe(false);
    });
    it('handles Date objects', () => {
      expect(isDueIn60(new Date('2026-02-15'), new Date('2026-01-01'))).toBe(true);
    });
  });

  describe('isOverdue', () => {
    it('detects overdue', () => {
      expect(isOverdue('2025-12-31', '2026-01-01')).toBe(true);
      expect(isOverdue('2026-01-01', '2026-01-01')).toBe(false);
      expect(isOverdue('2026-01-02', '2026-01-01')).toBe(false);
    });
  });

  describe('daysUntil', () => {
    it('calculates days correctly inclusive', () => {
      expect(daysUntil('2026-01-01', '2026-01-01')).toBe(0);
      expect(daysUntil('2026-01-10', '2026-01-01')).toBe(9);
      expect(daysUntil('2025-12-31', '2026-01-01')).toBe(-1);
    });
  });
});
