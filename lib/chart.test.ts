import { describe, it, expect } from 'vitest';
import { getKgbPerMonth, getKpByJenis } from './chart';
import { normalizeDate } from './schedule';

function mkPegawai(overrides: Partial<{
  tmtKgb: string;
  tmtKp: string;
  jenis: string;
  kredit: number;
  thresholdNext: number | null;
}> = {}) {
  return {
    tmtKgb: new Date(overrides.tmtKgb ?? '2024-03-01'),
    tmtKp: new Date(overrides.tmtKp ?? '2020-01-01'),
    jenis: overrides.jenis ?? 'struktural',
    kredit: overrides.kredit ?? 0,
    pangkat: { thresholdNext: overrides.thresholdNext ?? 100 },
  };
}

describe('lib/chart', () => {
  describe('getKgbPerMonth', () => {
    it('counts KGB per bulan 12 ke depan', () => {
      const today = normalizeDate('2026-01-01');
      // 3 pegawai with KGB due in Jan, Feb, Jan 2026
      const p1 = mkPegawai({ tmtKgb: '2024-01-15' }); // next 2026-01-15
      const p2 = mkPegawai({ tmtKgb: '2024-02-10' }); // next 2026-02-10
      const p3 = mkPegawai({ tmtKgb: '2024-01-20' }); // next 2026-01-20
      const result = getKgbPerMonth([p1, p2, p3], today);
      expect(result.length).toBe(12);
      expect(result[0]!.month).toBe('2026-01');
      expect(result[0]!.count).toBe(2);
      expect(result[1]!.month).toBe('2026-02');
      expect(result[1]!.count).toBe(1);
      expect(result[2]!.count).toBe(0);
    });

    it('ignores KGB outside 12 months', () => {
      const today = normalizeDate('2026-01-01');
      const p = mkPegawai({ tmtKgb: '2024-06-01' }); // next 2026-06-01 within 12
      const pFar = mkPegawai({ tmtKgb: '2026-06-01' }); // next 2028-06-01 outside
      const result = getKgbPerMonth([p, pFar], today);
      expect(result[5]!.month).toBe('2026-06');
      expect(result[5]!.count).toBe(1);
      // total counts should be 1
      expect(result.reduce((s, r) => s + r.count, 0)).toBe(1);
    });

    it('returns 12 buckets even with empty input', () => {
      const today = normalizeDate('2026-01-01');
      const result = getKgbPerMonth([], today);
      expect(result.length).toBe(12);
      expect(result.every((r) => r.count === 0)).toBe(true);
    });
  });

  describe('getKpByJenis', () => {
    it('counts KP due within 60 by jenis', () => {
      const today = normalizeDate('2026-01-01');
      // struktural due 2026-02-15 within 60
      const s1 = mkPegawai({ jenis: 'struktural', tmtKp: '2022-02-15' });
      // fungsional_biasa crossing due Jan 1 2027 but today Jan1 2026 -> 365 days away not due
      // So make today Nov 2 2026 for fungsional
      const todayNov = normalizeDate('2026-11-02');
      const f1 = mkPegawai({ jenis: 'fungsional_biasa', kredit: 145, thresholdNext: 150, tmtKp: '2022-01-01' });
      const f2 = mkPegawai({ jenis: 'fungsional_muda', kredit: 80, thresholdNext: 100, tmtKp: '2022-01-01' });
      const resultJan = getKpByJenis([s1], today);
      expect(resultJan.find((r) => r.jenis === 'struktural')?.count).toBe(1);
      expect(resultJan.find((r) => r.jenis === 'fungsional_biasa')?.count).toBe(0);

      const resultNov = getKpByJenis([f1, f2], todayNov);
      expect(resultNov.find((r) => r.jenis === 'fungsional_biasa')?.count).toBe(1);
      expect(resultNov.find((r) => r.jenis === 'fungsional_muda')?.count).toBe(1);
      expect(resultNov.find((r) => r.jenis === 'struktural')?.count).toBe(0);
    });

    it('returns all jenis with zero when none due', () => {
      const today = normalizeDate('2026-06-01');
      const p = mkPegawai({ jenis: 'struktural', tmtKp: '2022-06-01' }); // next 2026-06-01 due today? Actually 2026-06-01 is due
      // Make far future
      const far = mkPegawai({ jenis: 'struktural', tmtKp: '2023-12-01' }); // 2027-12-01 far
      const result = getKpByJenis([far], today);
      expect(result.length).toBe(3);
      expect(result.every((r) => r.count === 0)).toBe(true);
    });
  });
});
