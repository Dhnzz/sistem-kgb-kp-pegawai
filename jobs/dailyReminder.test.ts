import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectDueItems, runDailyReminder } from './dailyReminder';
import { toISODate, normalizeDate } from '@/lib/schedule';

// Helper to create mock pegawai
function mkPegawai(overrides: Partial<{
  id: string;
  nama: string;
  email: string;
  nip: string;
  jenis: string;
  tmtKgb: string;
  tmtKp: string;
  kredit: number;
  thresholdNext: number | null;
}> = {}) {
  return {
    id: overrides.id ?? `peg-${Math.random()}`,
    nama: overrides.nama ?? 'Budi Santoso',
    email: overrides.email ?? 'budi@example.com',
    nip: overrides.nip ?? '198001010000000001',
    jenis: overrides.jenis ?? 'struktural',
    tmtKgb: new Date(overrides.tmtKgb ?? '2024-03-01'),
    tmtKp: new Date(overrides.tmtKp ?? '2020-01-01'),
    kredit: overrides.kredit ?? 0,
    pangkat: overrides.thresholdNext !== undefined ? { thresholdNext: overrides.thresholdNext } : { thresholdNext: 100 },
  };
}

describe('collectDueItems', () => {
  it('KGB due within 60 days is collected', () => {
    const today = normalizeDate('2026-01-01');
    // tmtKgb 2024-03-01 => next 2026-03-01 => 59 days from Jan1 => due
    const p = mkPegawai({ tmtKgb: '2024-03-01', tmtKp: '2020-06-01', jenis: 'struktural' });
    // KP struktural 2020-06-01 +4y =2024-06-01 overdue not due
    const items = collectDueItems([p], today);
    expect(items.some((i) => i.type === 'KGB')).toBe(true);
  });

  it('KGB not due beyond 60 days is not collected', () => {
    const today = normalizeDate('2026-01-01');
    const p = mkPegawai({ tmtKgb: '2024-06-01', tmtKp: '2020-01-01' }); // KGB 2026-06-01 far
    const items = collectDueItems([p], today);
    expect(items.filter((i) => i.type === 'KGB').length).toBe(0);
  });

  it('KP struktural +4y due within 60', () => {
    const today = normalizeDate('2026-01-01');
    // tmtKp 2022-02-15 +4y =2026-02-15 => 45 days => due
    const p = mkPegawai({ tmtKgb: '2024-06-01', tmtKp: '2022-02-15', jenis: 'struktural' });
    const items = collectDueItems([p], today);
    expect(items.some((i) => i.type === 'KP')).toBe(true);
    expect(items.find((i) => i.type === 'KP')?.dueDate.toISOString().slice(0, 10)).toBe('2026-02-15');
  });

  it('KP fungsional forecast crossing within 60 (Nov -> Jan1)', () => {
    const today = normalizeDate('2026-11-02'); // 60 days to Jan1 2027
    // kredit 145 +12.5 >=150 => due Jan1 2027 => within 60 from Nov2 true
    const p = mkPegawai({
      jenis: 'fungsional_biasa',
      kredit: 145,
      thresholdNext: 150,
      tmtKgb: '2024-06-01', // not due
      tmtKp: '2022-01-01',
    });
    const items = collectDueItems([p], today);
    expect(items.some((i) => i.type === 'KP')).toBe(true);
    expect(items.find((i) => i.type === 'KP')?.dueDate.toISOString().slice(0, 10)).toBe('2027-01-01');
  });

  it('KP fungsional not crossing => not due', () => {
    const today = normalizeDate('2026-11-02');
    const p = mkPegawai({
      jenis: 'fungsional_biasa',
      kredit: 100,
      thresholdNext: 150,
      tmtKgb: '2024-06-01',
      tmtKp: '2022-01-01',
    });
    const items = collectDueItems([p], today);
    expect(items.some((i) => i.type === 'KP')).toBe(false);
  });

  it('KP fungsional crossing but far >60 not due', () => {
    const today = normalizeDate('2026-06-01'); // 214 days to Jan1 2027
    const p = mkPegawai({
      jenis: 'fungsional_biasa',
      kredit: 145,
      thresholdNext: 150,
      tmtKgb: '2024-06-01',
      tmtKp: '2022-01-01',
    });
    const items = collectDueItems([p], today);
    expect(items.some((i) => i.type === 'KP')).toBe(false);
  });
});

describe('runDailyReminder idempoten + retry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.WEBHOOK_URL = '';
    process.env.ADMIN_EMAIL = '';
  });

  it('sends email for due items and logs sent, second run skipped (idempoten)', async () => {
    const today = normalizeDate('2026-01-01');
    const peg = mkPegawai({ id: 'peg-1', tmtKgb: '2024-03-01', jenis: 'struktural', email: 'a@example.com' });

    // Mock prisma
    const created: unknown[] = [];
    const mockPrisma = {
      pegawai: {
        findMany: vi.fn().mockResolvedValue([peg]),
      },
      notificationLog: {
        findFirst: vi.fn().mockResolvedValue(null), // no existing
        create: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => {
          created.push(data);
          return { id: 'log-1', ...(data as object) } as unknown;
        }),
      },
    } as unknown as typeof import('@/lib/prisma').prisma;

    const sendEmailFn = vi.fn().mockResolvedValue({ messageId: 'mid-1' });

    const result1 = await runDailyReminder({
      today,
      prismaClient: mockPrisma,
      sendEmailFn,
      dispatchWebhookFn: vi.fn(),
    });

    expect(result1.total).toBe(1);
    expect(result1.sent).toBe(1);
    expect(result1.skipped).toBe(0);
    expect(sendEmailFn).toHaveBeenCalledTimes(1);
    expect(mockPrisma.notificationLog.create).toHaveBeenCalledTimes(1);

    // Second run: existing sent log found -> skipped
    const mockPrisma2 = {
      pegawai: {
        findMany: vi.fn().mockResolvedValue([peg]),
      },
      notificationLog: {
        findFirst: vi.fn().mockResolvedValue({ id: 'log-1', status: 'sent' }),
        create: vi.fn(),
      },
    } as unknown as typeof import('@/lib/prisma').prisma;

    const sendEmailFn2 = vi.fn().mockResolvedValue({ messageId: 'mid-2' });

    const result2 = await runDailyReminder({
      today,
      prismaClient: mockPrisma2,
      sendEmailFn: sendEmailFn2,
      dispatchWebhookFn: vi.fn(),
    });

    expect(result2.skipped).toBe(1);
    expect(result2.sent).toBe(0);
    expect(sendEmailFn2).not.toHaveBeenCalled();
    expect(mockPrisma2.notificationLog.create).not.toHaveBeenCalled();
  });

  it('retry 1x when email fails first then succeeds', async () => {
    const today = normalizeDate('2026-01-01');
    const peg = mkPegawai({ id: 'peg-2', tmtKgb: '2024-03-01', jenis: 'struktural' });

    const mockPrisma = {
      pegawai: {
        findMany: vi.fn().mockResolvedValue([peg]),
      },
      notificationLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'log' }),
      },
    } as unknown as typeof import('@/lib/prisma').prisma;

    const sendEmailFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('smtp timeout'))
      .mockResolvedValueOnce({ messageId: 'mid-retry' });

    const result = await runDailyReminder({
      today,
      prismaClient: mockPrisma,
      sendEmailFn,
      dispatchWebhookFn: vi.fn(),
    });

    expect(sendEmailFn).toHaveBeenCalledTimes(2); // retry
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('failed after retry 1x logs failed', async () => {
    const today = normalizeDate('2026-01-01');
    const peg = mkPegawai({ id: 'peg-3', tmtKgb: '2024-03-01', jenis: 'struktural' });

    const createdPayload: unknown[] = [];
    const mockPrisma = {
      pegawai: {
        findMany: vi.fn().mockResolvedValue([peg]),
      },
      notificationLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: { data: unknown }) => {
          createdPayload.push(data);
          return { id: 'log', ...(data as object) } as unknown;
        }),
      },
    } as unknown as typeof import('@/lib/prisma').prisma;

    const sendEmailFn = vi.fn().mockRejectedValue(new Error('permanent fail'));

    const result = await runDailyReminder({
      today,
      prismaClient: mockPrisma,
      sendEmailFn,
      dispatchWebhookFn: vi.fn(),
    });

    expect(sendEmailFn).toHaveBeenCalledTimes(2);
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    // check log status failed
    const logged = createdPayload[0] as { status: string; error: string };
    expect(logged.status).toBe('failed');
    expect(logged.error).toContain('permanent fail');
  });

  it('handles P2002 unique violation as skipped', async () => {
    const today = normalizeDate('2026-01-01');
    const peg = mkPegawai({ id: 'peg-4', tmtKgb: '2024-03-01', jenis: 'struktural' });

    const mockPrisma = {
      pegawai: {
        findMany: vi.fn().mockResolvedValue([peg]),
      },
      notificationLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(Object.assign(new Error('Unique constraint'), { code: 'P2002' })),
      },
    } as unknown as typeof import('@/lib/prisma').prisma;

    const sendEmailFn = vi.fn().mockResolvedValue({ messageId: 'mid' });

    const result = await runDailyReminder({
      today,
      prismaClient: mockPrisma,
      sendEmailFn,
      dispatchWebhookFn: vi.fn(),
    });

    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('includes webhook channel when WEBHOOK_URL set', async () => {
    process.env.WEBHOOK_URL = 'https://example.com/hook';
    const today = normalizeDate('2026-01-01');
    const peg = mkPegawai({ id: 'peg-5', tmtKgb: '2024-03-01', jenis: 'struktural' });

    const mockPrisma = {
      pegawai: {
        findMany: vi.fn().mockResolvedValue([peg]),
      },
      notificationLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'log' }),
      },
    } as unknown as typeof import('@/lib/prisma').prisma;

    const sendEmailFn = vi.fn().mockResolvedValue({ messageId: 'mid' });
    const webhookFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await runDailyReminder({
      today,
      prismaClient: mockPrisma,
      sendEmailFn,
      dispatchWebhookFn: webhookFn,
    });

    expect(result.sent).toBe(2); // email + webhook
    expect(webhookFn).toHaveBeenCalledTimes(1);
    expect(sendEmailFn).toHaveBeenCalledTimes(1);
  });
});
