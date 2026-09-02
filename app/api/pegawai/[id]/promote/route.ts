import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

function getRole(session: unknown): string | null {
  return (session as { user?: { role?: string } })?.user?.role ?? null;
}

const promoteSchema = z.object({
  jenis: z.enum(['KGB', 'KP']),
  kePangkatId: z.string().uuid().optional().nullable(),
  tmtBaru: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tmtBaru harus YYYY-MM-DD').optional().nullable(),
  catatan: z.string().max(500).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = getRole(session);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const pegawai = await prisma.pegawai.findUnique({
    where: { id: params.id },
    include: { pangkat: true },
  });
  if (!pegawai) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = promoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { jenis, kePangkatId, tmtBaru, catatan } = parsed.data;
  const userId = (session.user as unknown as { id?: string })?.id ?? null;

  // Validate kePangkat if provided
  let targetPangkat: { id: string; kode: string; urutan: number } | null = null;
  if (kePangkatId) {
    const found = await prisma.pangkat.findUnique({ where: { id: kePangkatId } });
    if (!found) return NextResponse.json({ error: 'Pangkat tujuan tidak ditemukan' }, { status: 400 });
    targetPangkat = found;
  } else if (jenis === 'KP') {
    // Auto next pangkat by urutan
    const all = await prisma.pangkat.findMany({ orderBy: { urutan: 'asc' } });
    const idx = all.findIndex((p) => p.id === pegawai.pangkatId);
    if (idx >= 0 && idx < all.length - 1) {
      targetPangkat = all[idx + 1]!;
    }
  }

  const dariPangkatId = pegawai.pangkatId;
  const dariKredit = pegawai.kredit;
  const tmtLama = jenis === 'KGB' ? pegawai.tmtKgb : pegawai.tmtKp;
  const tmtBaruDate = tmtBaru ? new Date(tmtBaru) : new Date();
  // Normalize to UTC date-only
  const tmtBaruNormalized = new Date(Date.UTC(tmtBaruDate.getUTCFullYear(), tmtBaruDate.getUTCMonth(), tmtBaruDate.getUTCDate()));

  // For KP, kredit reset 0; for KGB, kredit unchanged
  const keKredit = jenis === 'KP' ? 0 : dariKredit;
  const kePangkatIdFinal = targetPangkat?.id ?? (jenis === 'KP' ? null : null);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Update pegawai
      const updateData: Record<string, unknown> = {};
      if (jenis === 'KGB') {
        updateData.tmtKgb = tmtBaruNormalized;
      } else {
        updateData.tmtKp = tmtBaruNormalized;
        updateData.kredit = keKredit;
        if (kePangkatIdFinal) updateData.pangkatId = kePangkatIdFinal;
      }
      if (userId) updateData.updatedBy = userId;

      const updated = await tx.pegawai.update({
        where: { id: pegawai.id },
        data: updateData as never,
        include: { pangkat: true },
      });

      const history = await tx.promotionHistory.create({
        data: {
          pegawaiId: pegawai.id,
          jenis: jenis as never,
          dariPangkatId: dariPangkatId as never,
          kePangkatId: (kePangkatIdFinal ?? dariPangkatId) as never,
          dariKredit: dariKredit as never,
          keKredit: keKredit as never,
          tmtLama: tmtLama as never,
          tmtBaru: tmtBaruNormalized as never,
          catatan: catatan ?? (jenis === 'KGB' ? 'Konfirmasi KGB manual' : 'Konfirmasi KP manual'),
          createdBy: userId as never,
        } as never,
        include: {
          dariPangkat: true,
          kePangkat: true,
          pegawai: true,
        },
      });

      return { updated, history };
    });

    return NextResponse.json({ data: result.updated, history: result.history });
  } catch (e) {
    console.error('[promote] failed', e);
    return NextResponse.json({ error: 'Gagal konfirmasi naik', details: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
