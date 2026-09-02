import { NextRequest, NextResponse } from 'next/server';
import { runYearlyCredit } from '@/jobs/yearlyCredit';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (auth && auth === `Bearer ${secret}`) return true;
  const xCron = req.headers.get('x-cron-secret') ?? req.headers.get('X-Cron-Secret');
  if (xCron && xCron === secret) return true;
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
    const result = await runYearlyCredit();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron/yearly] failed', e);
    return NextResponse.json(
      { error: 'Cron failed', details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
