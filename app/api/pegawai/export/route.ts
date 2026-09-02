import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateExportBuffer, toCsv } from '@/lib/excel';

function getRole(session: unknown): string | null {
  return (session as { user?: { role?: string } })?.user?.role ?? null;
}

function formatDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const da = String(date.getUTCDate()).padStart(2, '0');
  // Use UTC date part for DB Date type
  // Fallback to local if needed
  if (!isNaN(y)) return `${y}-${m}-${da}`;
  return String(d).slice(0, 10);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = getRole(session);
  if (role === 'pegawai') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') === 'csv' ? 'csv' : 'excel';
  const status = searchParams.get('status');
  const jenis = searchParams.get('jenis');

  const where: Record<string, unknown> = {};
  if (status && status !== 'all') (where as Record<string, unknown>).status = status;
  if (jenis) (where as Record<string, unknown>).jenis = jenis;

  const pegawais = await prisma.pegawai.findMany({
    where: where as never,
    include: { pangkat: true },
    orderBy: { nip: 'asc' },
  });

  const mapped = pegawais.map((p) => ({
    nip: p.nip,
    nama: p.nama,
    email: p.email,
    pangkatKode: p.pangkat.kode,
    pangkatNama: p.pangkat.nama,
    jenis: p.jenis,
    tmtKgb: formatDate(p.tmtKgb as unknown as Date),
    tmtKp: formatDate(p.tmtKp as unknown as Date),
    kredit: String(p.kredit),
    status: p.status,
  }));

  if (format === 'csv') {
    const csv = toCsv(mapped);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="rekap-pegawai.csv"',
      },
    });
  }

  const buffer = await generateExportBuffer(mapped);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="rekap-pegawai.xlsx"',
      'Content-Length': String(buffer.length),
    },
  });
}
