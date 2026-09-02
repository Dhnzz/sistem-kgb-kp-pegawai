import { NextRequest, NextResponse } from 'next/server';
import { runDailyReminder } from '@/jobs/dailyReminder';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // If no secret configured, allow in dev/test but warn
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (auth && auth === `Bearer ${secret}`) return true;
  const xCron = req.headers.get('x-cron-secret') ?? req.headers.get('X-Cron-Secret');
  if (xCron && xCron === secret) return true;
  // also support ?secret= query for manual testing (only non-prod)
  if (process.env.NODE_ENV !== 'production') {
    const urlSecret = new URL(req.url).searchParams.get('secret');
    if (urlSecret && urlSecret === secret) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailyReminder();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron/daily] failed', e);
    return NextResponse.json(
      { error: 'Cron failed', details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

// Also support POST for systemd curl compatibility
export async function POST(req: NextRequest) {
  return GET(req);
}
