import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

function getRole(session: unknown): string | null {
  return (session as { user?: { role?: string } })?.user?.role ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = getRole(session);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const status = searchParams.get('status'); // sent | failed
  const channel = searchParams.get('channel'); // email | webhook
  const type = searchParams.get('type'); // KGB | KP
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '20') || 20));

  const where: Record<string, unknown> = {};
  if (status && (status === 'sent' || status === 'failed')) (where as Record<string, unknown>).status = status;
  if (channel && (channel === 'email' || channel === 'webhook')) (where as Record<string, unknown>).channel = channel;
  if (type && (type === 'KGB' || type === 'KP')) (where as Record<string, unknown>).type = type;

  if (search) {
    (where as Record<string, unknown>).pegawai = {
      OR: [
        { nama: { contains: search, mode: 'insensitive' } },
        { nip: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [total, data] = await Promise.all([
    prisma.notificationLog.count({ where: where as never }),
    prisma.notificationLog.findMany({
      where: where as never,
      include: {
        pegawai: { select: { id: true, nip: true, nama: true, email: true } },
      },
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ data, total, page, pageSize });
}
