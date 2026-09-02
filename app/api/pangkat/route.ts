import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

function getRole(session: unknown): string | null {
  return (session as { user?: { role?: string } })?.user?.role ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await prisma.pangkat.findMany({ orderBy: { urutan: 'asc' } });
  return NextResponse.json({ data });
}

const pangkatPatchSchema = z.object({
  id: z.string().uuid(),
  thresholdNext: z.union([z.number().min(0), z.null()]).optional(),
  // allow null to clear (puncak), 0 not allowed per CHECK >0 but we accept 0 as clearing? enforce >0 if not null
});

const pangkatCreateSchema = z.object({
  kode: z.string().min(1).max(10),
  nama: z.string().min(1).max(50),
  golongan: z.string().min(1).max(5),
  level: z.number().int().min(1),
  urutan: z.number().int().min(1),
  thresholdNext: z.union([z.number().min(0.1), z.null()]).optional(),
});

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
  const parsed = pangkatCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { kode, nama, golongan, level, urutan, thresholdNext } = parsed.data;
  if (thresholdNext !== undefined && thresholdNext !== null && thresholdNext <= 0) {
    return NextResponse.json({ error: 'thresholdNext harus >0 atau null' }, { status: 400 });
  }
  try {
    const created = await prisma.pangkat.create({
      data: { kode, nama, golongan, level, urutan, thresholdNext: thresholdNext ?? null },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return NextResponse.json({ error: 'Kode atau urutan sudah ada' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = getRole(session);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 });

  const existing = await prisma.pangkat.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Pangkat tidak ditemukan' }, { status: 404 });

  const used = await prisma.pegawai.findFirst({ where: { pangkatId: id }, select: { id: true } });
  if (used) return NextResponse.json({ error: 'Pangkat masih dipakai pegawai, tidak bisa dihapus' }, { status: 409 });

  // Cek masih dipakai di riwayat sebagai FK SetNull — boleh hapus, tapi cek juga jika ada referensi lain
  await prisma.pangkat.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
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

  const parsed = pangkatPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { id, thresholdNext } = parsed.data;

  const existing = await prisma.pangkat.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Pangkat tidak ditemukan' }, { status: 404 });

  if (thresholdNext !== undefined) {
    if (thresholdNext !== null && thresholdNext <= 0) {
      return NextResponse.json({ error: 'thresholdNext harus >0 atau null' }, { status: 400 });
    }
  }

  const updated = await prisma.pangkat.update({
    where: { id },
    data: {
      thresholdNext: thresholdNext === undefined ? undefined : thresholdNext,
    },
  });

  return NextResponse.json({ data: updated });
}
