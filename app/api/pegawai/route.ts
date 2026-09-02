import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { pegawaiFormSchema } from '@/lib/pegawai-validation';

function getRole(session: unknown): string | null {
  return (session as { user?: { role?: string } })?.user?.role ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = getRole(session);
  if (role === 'pegawai') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const jenis = searchParams.get('jenis');
  const status = searchParams.get('status') ?? 'aktif';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '20') || 20));
  const pangkatId = searchParams.get('pangkatId');

  const where: Record<string, unknown> = {};
  if (status && status !== 'all') (where as Record<string, unknown>).status = status;
  if (jenis) (where as Record<string, unknown>).jenis = jenis;
  if (pangkatId) (where as Record<string, unknown>).pangkatId = pangkatId;
  if (search) {
    (where as Record<string, unknown>).OR = [
      { nip: { contains: search, mode: 'insensitive' } },
      { nama: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, data] = await Promise.all([
    prisma.pegawai.count({ where: where as never }),
    prisma.pegawai.findMany({
      where: where as never,
      include: { pangkat: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ data, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = getRole(session);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = pegawaiFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Check pangkat exists
  const pangkat = await prisma.pangkat.findUnique({ where: { id: input.pangkatId } });
  if (!pangkat) return NextResponse.json({ error: 'Pangkat tidak ditemukan' }, { status: 400 });

  // Unique checks
  const existingNip = await prisma.pegawai.findUnique({ where: { nip: input.nip } });
  if (existingNip) return NextResponse.json({ error: 'NIP sudah ada' }, { status: 409 });
  const existingEmail = await prisma.pegawai.findUnique({ where: { email: input.email } });
  if (existingEmail) return NextResponse.json({ error: 'Email sudah ada' }, { status: 409 });

  const userId = (session.user as unknown as { id?: string })?.id;

  const created = await prisma.pegawai.create({
    data: {
      nip: input.nip,
      nama: input.nama,
      email: input.email.toLowerCase(),
      pangkatId: input.pangkatId,
      jenis: input.jenis as never,
      tmtKgb: new Date(input.tmtKgb),
      tmtKp: new Date(input.tmtKp),
      kredit: input.kredit,
      status: (input.status as never) ?? 'aktif',
      updatedBy: userId,
    },
    include: { pangkat: true },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
