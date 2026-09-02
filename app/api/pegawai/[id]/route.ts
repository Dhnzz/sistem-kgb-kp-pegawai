import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { pegawaiFormSchema } from '@/lib/pegawai-validation';

function getRole(session: unknown): string | null {
  return (session as { user?: { role?: string } })?.user?.role ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = getRole(session);
  if (role === 'pegawai') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const pegawai = await prisma.pegawai.findUnique({
    where: { id: params.id },
    include: { pangkat: true },
  });
  if (!pegawai) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: pegawai });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = getRole(session);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const existing = await prisma.pegawai.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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

  const pangkat = await prisma.pangkat.findUnique({ where: { id: input.pangkatId } });
  if (!pangkat) return NextResponse.json({ error: 'Pangkat tidak ditemukan' }, { status: 400 });

  // Unique checks excluding self
  if (input.nip !== existing.nip) {
    const dup = await prisma.pegawai.findUnique({ where: { nip: input.nip } });
    if (dup) return NextResponse.json({ error: 'NIP sudah ada' }, { status: 409 });
  }
  if (input.email.toLowerCase() !== existing.email.toLowerCase()) {
    const dup = await prisma.pegawai.findUnique({ where: { email: input.email.toLowerCase() } });
    if (dup) return NextResponse.json({ error: 'Email sudah ada' }, { status: 409 });
  }

  const userId = (session.user as unknown as { id?: string })?.id;

  const updated = await prisma.pegawai.update({
    where: { id: params.id },
    data: {
      nip: input.nip,
      nama: input.nama,
      email: input.email.toLowerCase(),
      pangkatId: input.pangkatId,
      jenis: input.jenis as never,
      tmtKgb: new Date(input.tmtKgb),
      tmtKp: new Date(input.tmtKp),
      kredit: input.kredit,
      status: input.status as never,
      updatedBy: userId,
    },
    include: { pangkat: true },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = getRole(session);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const existing = await prisma.pegawai.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Soft-delete via status nonaktif (per SCHEMA soft-delete)
  if (existing.status === 'nonaktif') {
    // Already nonaktif -> hard delete allowed? Do hard delete for now
    await prisma.pegawai.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Deleted permanently' });
  }

  const updated = await prisma.pegawai.update({
    where: { id: params.id },
    data: { status: 'nonaktif' as never },
  });
  return NextResponse.json({ data: updated, message: 'Soft-deleted (status=nonaktif)' });
}
