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
  const userPegawaiId = (session.user as unknown as { pegawaiId?: string | null })?.pegawaiId ?? null;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const jenis = searchParams.get('jenis'); // KGB | KP
  const pegawaiId = searchParams.get('pegawaiId');
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '20') || 20));

  const where: Record<string, unknown> = {};

  // Pegawai role only sees own history
  if (role === 'pegawai' && userPegawaiId) {
    (where as Record<string, unknown>).pegawaiId = userPegawaiId;
  } else if (pegawaiId) {
    (where as Record<string, unknown>).pegawaiId = pegawaiId;
  }

  if (jenis && (jenis === 'KGB' || jenis === 'KP')) {
    (where as Record<string, unknown>).jenis = jenis;
  }

  if (search) {
    // Search by pegawai nama/nip via relation
    (where as Record<string, unknown>).pegawai = {
      OR: [
        { nama: { contains: search, mode: 'insensitive' } },
        { nip: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [total, data] = await Promise.all([
    prisma.promotionHistory.count({ where: where as never }),
    prisma.promotionHistory.findMany({
      where: where as never,
      include: {
        pegawai: { select: { id: true, nip: true, nama: true, email: true } },
        dariPangkat: { select: { id: true, kode: true, nama: true } },
        kePangkat: { select: { id: true, kode: true, nama: true } },
        creator: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ data, total, page, pageSize });
}
