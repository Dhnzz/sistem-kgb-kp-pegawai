import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runYearlyCredit } from './yearlyCredit';

function mkPegawai(overrides: Partial<{
  id: string; nama: string; email: string; nip: string; jenis: string;
  kredit: number | string; pangkat: { id: string; kode: string; urutan: number; thresholdNext: number | null } | null;
  tmtKp: Date;
}> = {}) {
  return {
    id: overrides.id ?? `peg-${Math.random().toString(36).slice(2, 6)}`,
    nama: overrides.nama ?? 'Budi Santoso',
    email: overrides.email ?? 'budi@example.com',
    nip: overrides.nip ?? '198001010000000001',
    jenis: overrides.jenis ?? 'fungsional_biasa',
    kredit: overrides.kredit ?? 0,
    pangkat: overrides.pangkat ?? { id: 'p-3b', kode: '3B', urutan: 10, thresholdNext: 100 },
    tmtKp: overrides.tmtKp ?? new Date(Date.UTC(2024, 0, 1)),
    tmtKgb: new Date(Date.UTC(2024, 0, 1)),
    status: 'aktif' as const,
  };
}

function mkPangkat(list: Array<{ id: string; kode: string; urutan: number; thresholdNext: number | null }>) {
  return list;
}

describe('runYearlyCredit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('verifiable: kredit 95 +12.5 →107.5 auto naik 3B→3C (threshold 100)', async () => {
    const p3b = { id: 'p-3b', kode: '3B', urutan: 10, thresholdNext: 100 };
    const p3c = { id: 'p-3c', kode: '3C', urutan: 11, thresholdNext: 150 };
    const peg = mkPegawai({ id: 'peg-1', kredit: 95, jenis: 'fungsional_biasa', pangkat: p3b });

    const updates: unknown[] = [];
    const histories: unknown[] = [];
    const mockPrisma = {
      promotionHistory: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      pegawai: {
        findMany: vi.fn().mockResolvedValue([peg]),
        update: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => {
          updates.push(data);
          return peg;
        }),
      },
      pangkat: {
        findMany: vi.fn().mockResolvedValue(mkPangkat([p3b, p3c])),
      },
      $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          pegawai: {
            update: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => {
              updates.push(data);
              return peg;
            }),
          },
          promotionHistory: {
            create: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => {
              histories.push(data);
              return { id: 'hist-1', ...data as object };
            }),
          },
        };
        await fn(tx);
      }),
    } as unknown as never;

    const sendEmailFn = vi.fn().mockResolvedValue({ messageId: 'mid' });

    const result = await runYearlyCredit({
      today: new Date(Date.UTC(2027, 0, 1)),
      prismaClient: mockPrisma as never,
      sendEmailFn,
    });

    expect(result.promoted).toBe(1);
    expect(result.credited).toBe(0);
    expect(histories.length).toBe(1);
    const hist = histories[0] as Record<string, unknown>;
    expect(hist.jenis).toBe('KP');
    expect(String(hist.dariKredit)).toBe('95');
    expect(String(hist.keKredit)).toBe('0');
    expect(hist.dariPangkatId).toBe('p-3b');
    expect(hist.kePangkatId).toBe('p-3c');
    expect(sendEmailFn).toHaveBeenCalledTimes(1);
    // Verify kredit reset 0 and pangkat updated
    const upd = updates[0] as Record<string, unknown>;
    expect(upd.kredit).toBe(0);
    expect(upd.pangkatId).toBe('p-3c');
  });

  it('kredit below threshold only increments, no promotion', async () => {
    const p3c = { id: 'p-3c', kode: '3C', urutan: 11, thresholdNext: 150 };
    const p3d = { id: 'p-3d', kode: '3D', urutan: 12, thresholdNext: 150 };
    const peg = mkPegawai({ id: 'peg-2', kredit: 100, jenis: 'fungsional_biasa', pangkat: p3c });

    const updates: unknown[] = [];
    const mockPrisma = {
      promotionHistory: { findFirst: vi.fn().mockResolvedValue(null) },
      pegawai: {
        findMany: vi.fn().mockResolvedValue([peg]),
        update: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => {
          updates.push(data);
          return peg;
        }),
      },
      pangkat: { findMany: vi.fn().mockResolvedValue(mkPangkat([p3c, p3d])) },
      $transaction: vi.fn(),
    } as unknown as never;

    const result = await runYearlyCredit({
      today: new Date(Date.UTC(2027, 0, 1)),
      prismaClient: mockPrisma as never,
      sendEmailFn: vi.fn(),
    });

    expect(result.credited).toBe(1);
    expect(result.promoted).toBe(0);
    expect(updates[0]).toMatchObject({ kredit: 112.5 });
  });

  it('struktural skipped, fungsional_muda rate 25', async () => {
    const p3b = { id: 'p-3b', kode: '3B', urutan: 10, thresholdNext: 100 };
    const p3c = { id: 'p-3c', kode: '3C', urutan: 11, thresholdNext: 150 };
    const pegStrukt = mkPegawai({ id: 'peg-s', kredit: 0, jenis: 'struktural', pangkat: p3b });
    const pegMuda = mkPegawai({ id: 'peg-m', kredit: 80, jenis: 'fungsional_muda', pangkat: p3b });

    const updates: unknown[] = [];
    const histories: unknown[] = [];
    const mockPrisma = {
      promotionHistory: { findFirst: vi.fn().mockResolvedValue(null) },
      pegawai: {
        findMany: vi.fn().mockResolvedValue([pegStrukt, pegMuda]),
        update: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => {
          updates.push(data);
          return pegMuda;
        }),
      },
      pangkat: { findMany: vi.fn().mockResolvedValue(mkPangkat([p3b, p3c])) },
      $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          pegawai: { update: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => { updates.push(data); return pegMuda; }) },
          promotionHistory: { create: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => { histories.push(data); return { id: 'h', ...data as object }; }) },
        };
        await fn(tx);
      }),
    } as unknown as never;

    const result = await runYearlyCredit({
      today: new Date(Date.UTC(2027, 0, 1)),
      prismaClient: mockPrisma as never,
      sendEmailFn: vi.fn().mockResolvedValue({ messageId: 'mid' }),
    });

    expect(result.skipped).toBe(1); // struktural
    expect(result.promoted).toBe(1); // 80+25=105 >=100
    expect(histories.length).toBe(1);
  });

  it('puncak (threshold null) never promotes, just credits', async () => {
    const puncak = { id: 'p-4e', kode: '4E', urutan: 17, thresholdNext: null };
    const peg = mkPegawai({ id: 'peg-p', kredit: 200, jenis: 'fungsional_biasa', pangkat: puncak });

    const updates: unknown[] = [];
    const mockPrisma = {
      promotionHistory: { findFirst: vi.fn().mockResolvedValue(null) },
      pegawai: {
        findMany: vi.fn().mockResolvedValue([peg]),
        update: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => { updates.push(data); return peg; }),
      },
      pangkat: { findMany: vi.fn().mockResolvedValue(mkPangkat([puncak])) },
      $transaction: vi.fn(),
    } as unknown as never;

    const result = await runYearlyCredit({
      today: new Date(Date.UTC(2027, 0, 1)),
      prismaClient: mockPrisma as never,
      sendEmailFn: vi.fn(),
    });

    expect(result.credited).toBe(1);
    expect(result.promoted).toBe(0);
    expect((updates[0] as Record<string, unknown>).kredit).toBe(212.5);
  });

  it('idempoten: if auto-promote history exists for Jan1, returns 0 processed', async () => {
    const mockPrisma = {
      promotionHistory: { findFirst: vi.fn().mockResolvedValue({ id: 'existing' }) },
      pegawai: { findMany: vi.fn() },
      pangkat: { findMany: vi.fn() },
    } as unknown as never;

    const result = await runYearlyCredit({
      today: new Date(Date.UTC(2027, 0, 1)),
      prismaClient: mockPrisma as never,
      sendEmailFn: vi.fn(),
    });

    expect(result.processed).toBe(0);
    expect(result.promoted).toBe(0);
  });

  it('exact threshold crossing promotes (137.5+12.5=150 >=150)', async () => {
    const p3c = { id: 'p-3c', kode: '3C', urutan: 11, thresholdNext: 150 };
    const p3d = { id: 'p-3d', kode: '3D', urutan: 12, thresholdNext: 150 };
    const peg = mkPegawai({ id: 'peg-exact', kredit: 137.5, jenis: 'fungsional_biasa', pangkat: p3c });

    const histories: unknown[] = [];
    const mockPrisma = {
      promotionHistory: { findFirst: vi.fn().mockResolvedValue(null) },
      pegawai: { findMany: vi.fn().mockResolvedValue([peg]), update: vi.fn() },
      pangkat: { findMany: vi.fn().mockResolvedValue(mkPangkat([p3c, p3d])) },
      $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          pegawai: { update: vi.fn().mockResolvedValue(peg) },
          promotionHistory: { create: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => { histories.push(data); return { id: 'h', ...data as object }; }) },
        };
        await fn(tx);
      }),
    } as unknown as never;

    const result = await runYearlyCredit({
      today: new Date(Date.UTC(2027, 0, 1)),
      prismaClient: mockPrisma as never,
      sendEmailFn: vi.fn().mockResolvedValue({ messageId: 'mid' }),
    });

    expect(result.promoted).toBe(1);
    expect(histories.length).toBe(1);
  });
});
