import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the jobs module to avoid real DB
vi.mock('@/jobs/dailyReminder', () => ({
  runDailyReminder: vi.fn().mockResolvedValue({ ok: true, total: 1, sent: 1, failed: 0, skipped: 0, today: '2026-01-01', details: [] }),
}));

import { GET } from './route';
import { runDailyReminder } from '@/jobs/dailyReminder';

describe('/api/cron/daily', () => {
  const secret = 'test-cron-secret-123';

  beforeEach(() => {
    process.env.CRON_SECRET = secret;
    vi.clearAllMocks();
  });

  it('returns 401 when no auth header', async () => {
    const req = new NextRequest('http://localhost/api/cron/daily');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when wrong secret', async () => {
    const req = new NextRequest('http://localhost/api/cron/daily', {
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('succeeds with correct Bearer token', async () => {
    const req = new NextRequest('http://localhost/api/cron/daily', {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(runDailyReminder).toHaveBeenCalledTimes(1);
  });

  it('succeeds with x-cron-secret header', async () => {
    const req = new NextRequest('http://localhost/api/cron/daily', {
      headers: { 'x-cron-secret': secret },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
