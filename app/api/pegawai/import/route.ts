import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { parseExcelBuffer, validateRows } from '@/lib/excel';

function getRole(session: unknown): string | null {
  return (session as { user?: { role?: string } })?.user?.role ?? null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = getRole(session);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const confirm = url.searchParams.get('confirm') === 'true';

  let buffer: Buffer | null = null;

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan (field file)' }, { status: 400 });
    const ab = await file.arrayBuffer();
    buffer = Buffer.from(ab);
  } else if (contentType.includes('application/json')) {
    // Allow JSON with { bufferBase64 } fallback for tests
    const json = await req.json().catch(() => null);
    if (json?.bufferBase64) {
      buffer = Buffer.from(json.bufferBase64, 'base64');
    } else {
      return NextResponse.json({ error: 'Expected multipart file or bufferBase64' }, { status: 400 });
    }
  } else {
    // Try formData regardless
    try {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      if (file) {
        const ab = await file.arrayBuffer();
        buffer = Buffer.from(ab);
      }
    } catch {
      // ignore
    }
    if (!buffer) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
  }

  let rows;
  try {
    rows = await parseExcelBuffer(buffer);
  } catch (e) {
    return NextResponse.json({ error: 'Gagal parse Excel', details: (e as Error).message }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'File kosong atau header tidak sesuai' }, { status: 400 });
  }

  // Load context for validation
  const pangkats = await prisma.pangkat.findMany();
  const pangkatMap = new Map<string, string>();
  pangkats.forEach((p) => {
    pangkatMap.set(p.kode.toUpperCase(), p.id);
    pangkatMap.set(p.kode, p.id);
  });

  const existingPegawai = await prisma.pegawai.findMany({ select: { nip: true, email: true } });
  const existingNips = new Set(existingPegawai.map((p) => p.nip));
  const existingEmails = new Set(existingPegawai.map((p) => p.email.toLowerCase()));

  const { validRows, invalidRows } = validateRows(rows, {
    pangkatMap,
    existingNips,
    existingEmails,
  });

  if (!confirm) {
    return NextResponse.json({
      preview: true,
      total: rows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      validRows,
      invalidRows,
    });
  }

  // Confirm bulk insert
  if (validRows.length === 0) {
    return NextResponse.json({ error: 'Tidak ada baris valid untuk diimpor', invalidRows }, { status: 400 });
  }

  const userId = (session.user as unknown as { id?: string })?.id;
  let inserted = 0;
  const errors: unknown[] = [];

  for (const r of validRows) {
    const pangkatId =
      pangkatMap.get(r.kode_pangkat.toUpperCase()) ?? pangkatMap.get(r.kode_pangkat) ?? '';
    try {
      await prisma.pegawai.create({
        data: {
          nip: r.nip,
          nama: r.nama,
          email: r.email.toLowerCase(),
          pangkatId,
          jenis: r.jenis as never,
          tmtKgb: new Date(r.tmt_kgb),
          tmtKp: new Date(r.tmt_kp),
          kredit: Number(r.kredit),
          status: 'aktif',
          updatedBy: userId,
        },
      });
      inserted++;
    } catch (e) {
      errors.push({ rowNumber: r.rowNumber, error: (e as Error).message.slice(0, 300) });
    }
  }

  return NextResponse.json({
    preview: false,
    inserted,
    total: rows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    invalidRows,
    errors,
  });
}
