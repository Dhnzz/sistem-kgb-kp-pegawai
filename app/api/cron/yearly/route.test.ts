import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/jobs/yearlyCredit', () => ({
  runYearlyCredit: vi.fn().mockResolvedValue({ ok: true, year: 2027, processed: 1, promoted: 1, credited: 0, skipped: 0, failed: 0, today: '2027-01-01', details: [] }),
}));

import { GET } from './route';
import { runYearlyCredit } from '@/jobs/yearlyCredit';

describe('/api/cron/yearly', () => {
  const secret = 'test-cron-secret-123';

  beforeEach(() => {
    process.env.CRON_SECRET = secret;
    vi.clearAllMocks();
  });

  it('returns 401 when no auth header', async () => {
    const req = new NextRequest('http://localhost/api/cron/yearly');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when wrong secret', async () => {
    const req = new NextRequest('http://localhost/api/cron/yearly', {
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('succeeds with correct Bearer token', async () => {
    const req = new NextRequest('http://localhost/api/cron/yearly', {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(runYearlyCredit).toHaveBeenCalledTimes(1);
  });

  it('succeeds with x-cron-secret header', async () => {
    const req = new NextRequest('http://localhost/api/cron/yearly', {
      headers: { 'x-cron-secret': secret },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
