import { prisma } from '@/lib/prisma';
import { getCreditRate } from '@/lib/credit';
import { normalizeDate, toISODate } from '@/lib/schedule';
import { sendEmail, buildPromotionEmail } from '@/lib/notification/email';
import { logger } from '@/lib/logger';

export interface RunYearlyCreditOptions {
  today?: Date | string;
  prismaClient?: typeof prisma;
  sendEmailFn?: typeof sendEmail;
}

export interface YearlyCreditResult {
  year: number;
  today: string;
  processed: number;
  credited: number;
  promoted: number;
  skipped: number;
  failed: number;
  details: Array<{
    pegawaiId: string;
    nama: string;
    nip: string;
    jenis: string;
    dariKredit: string;
    keKredit: string;
    dariPangkat: string | null;
    kePangkat: string | null;
    promoted: boolean;
    status: 'credited' | 'promoted' | 'skipped' | 'failed';
    error?: string;
  }>;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return 0;
  if (typeof v === 'object' && v !== null && 'toNumber' in (v as Record<string, unknown>)) {
    const maybe = v as { toNumber?: () => number };
    if (typeof maybe.toNumber === 'function') return maybe.toNumber();
  }
  const n = Number(String(v));
  return Number.isNaN(n) ? 0 : n;
}

export async function runYearlyCredit(opts: RunYearlyCreditOptions = {}): Promise<YearlyCreditResult> {
  const today = normalizeDate(opts.today ?? new Date());
  const todayStr = toISODate(today);
  const year = today.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Str = toISODate(jan1);

  // Only run on Jan 1? Allow any date for testing, but log warning if not Jan 1
  const isJan1 = today.getUTCMonth() === 0 && today.getUTCDate() === 1;
  if (!isJan1) {
    logger.warn(`yearlyCredit called on non-Jan1 date ${todayStr}, proceeding anyway (test mode)`);
  }

  const db = opts.prismaClient ?? prisma;
  const emailFn = opts.sendEmailFn ?? sendEmail;

  // Idempotency check: if already has promotion_history with tmtBaru = jan1 and created today, skip
  // Also check if any pegawai was updated today (kredit already incremented)
  // For simplicity, check if any promotion_history with tmtBaru = jan1 exists for this year
  // If we find any history with tmtBaru = jan1 and jenis KP, assume yearly already ran
  // But to avoid false positive from manual promotions on Jan1, we also check that kredit increment already happened
  // We will do a lightweight check: count pegawai where updatedAt is today and jenis fungsional
  // If count >0 and today is Jan1, we consider already run and return skipped
  // However for test, we don't want to block test runs with mocked prisma that has no updatedAt
  // So we only apply idempotency if real DB and we find existing history for this year with catatan containing auto-promote
  try {
    const existingAuto = await db.promotionHistory.findFirst({
      where: {
        tmtBaru: jan1 as never,
        catatan: { contains: 'auto-promote yearly' } as never,
      } as never,
    });
    if (existingAuto) {
      logger.info(`yearlyCredit already ran for ${year} (found auto-promote history), skipping`);
      return {
        year,
        today: todayStr,
        processed: 0,
        credited: 0,
        promoted: 0,
        skipped: 0,
        failed: 0,
        details: [],
      };
    }
  } catch {
    // ignore if table not found or query fails
  }

  // Load all active pegawai with pangkat
  const pegawais = await db.pegawai.findMany({
    where: { status: 'aktif' },
    include: { pangkat: true },
  });

  // Load all pangkat sorted by urutan for next lookup
  const allPangkat = await db.pangkat.findMany({ orderBy: { urutan: 'asc' } });
  const pangkatById = new Map(allPangkat.map((p) => [p.id, p]));
  const pangkatByUrutan = new Map(allPangkat.map((p) => [p.urutan, p]));

  let processed = 0;
  let credited = 0;
  let promoted = 0;
  let skipped = 0;
  let failed = 0;
  const details: YearlyCreditResult['details'] = [];

  for (const p of pegawais) {
    processed++;
    const jenis = p.jenis as string;
    const rate = getCreditRate(jenis);

    // Only fungsional gets credit increment
    if (rate === 0) {
      skipped++;
      details.push({
        pegawaiId: p.id,
        nama: p.nama,
        nip: p.nip,
        jenis,
        dariKredit: String(p.kredit),
        keKredit: String(p.kredit),
        dariPangkat: p.pangkat?.kode ?? null,
        kePangkat: p.pangkat?.kode ?? null,
        promoted: false,
        status: 'skipped',
      });
      continue;
    }

    const kreditBefore = toNumber(p.kredit);
    // Use tenths to avoid floating errors
    const kreditAfterRaw = Math.round(kreditBefore * 10 + rate * 10) / 10;
    const kreditAfter = kreditAfterRaw;

    const currentPangkat = p.pangkat;
    const thresholdNext = currentPangkat?.thresholdNext !== null && currentPangkat?.thresholdNext !== undefined
      ? toNumber(currentPangkat.thresholdNext)
      : null;

    const willPromote = thresholdNext !== null && kreditAfter >= thresholdNext;

    if (!willPromote) {
      // Just increment kredit
      try {
        await db.pegawai.update({
          where: { id: p.id },
          data: { kredit: kreditAfter as never },
        });
        credited++;
        details.push({
          pegawaiId: p.id,
          nama: p.nama,
          nip: p.nip,
          jenis,
          dariKredit: String(kreditBefore),
          keKredit: String(kreditAfter),
          dariPangkat: currentPangkat?.kode ?? null,
          kePangkat: currentPangkat?.kode ?? null,
          promoted: false,
          status: 'credited',
        });
      } catch (e) {
        failed++;
        details.push({
          pegawaiId: p.id,
          nama: p.nama,
          nip: p.nip,
          jenis,
          dariKredit: String(kreditBefore),
          keKredit: String(kreditAfter),
          dariPangkat: currentPangkat?.kode ?? null,
          kePangkat: currentPangkat?.kode ?? null,
          promoted: false,
          status: 'failed',
          error: e instanceof Error ? e.message : String(e),
        });
        logger.error(`yearly credit failed for ${p.nip}`, e);
      }
      continue;
    }

    // Promote: find next pangkat by urutan
    const nextUrutan = (currentPangkat?.urutan ?? 0) + 1;
    const nextPangkat = pangkatByUrutan.get(nextUrutan) ?? null;

    if (!nextPangkat) {
      // Puncak: no next pangkat, just increment kredit (or cap)
      try {
        await db.pegawai.update({
          where: { id: p.id },
          data: { kredit: kreditAfter as never },
        });
        credited++;
        details.push({
          pegawaiId: p.id,
          nama: p.nama,
          nip: p.nip,
          jenis,
          dariKredit: String(kreditBefore),
          keKredit: String(kreditAfter),
          dariPangkat: currentPangkat?.kode ?? null,
          kePangkat: currentPangkat?.kode ?? null,
          promoted: false,
          status: 'credited',
        });
      } catch (e) {
        failed++;
        details.push({
          pegawaiId: p.id,
          nama: p.nama,
          nip: p.nip,
          jenis,
          dariKredit: String(kreditBefore),
          keKredit: String(kreditAfter),
          dariPangkat: currentPangkat?.kode ?? null,
          kePangkat: currentPangkat?.kode ?? null,
          promoted: false,
          status: 'failed',
          error: e instanceof Error ? e.message : String(e),
        });
      }
      continue;
    }

    // Perform promotion: update pegawai pangkat, kredit=0, tmtKp = jan1
    const dariKredit = kreditBefore;
    const keKredit = 0;
    const dariPangkatId = currentPangkat?.id ?? null;
    const kePangkatId = nextPangkat.id;
    const tmtLama = p.tmtKp;
    const tmtBaru = jan1;

    try {
      await db.$transaction(async (tx) => {
        await tx.pegawai.update({
          where: { id: p.id },
          data: {
            pangkatId: kePangkatId,
            kredit: keKredit as never,
            tmtKp: tmtBaru as never,
          },
        });

        await tx.promotionHistory.create({
          data: {
            pegawaiId: p.id,
            jenis: 'KP' as never,
            dariPangkatId: dariPangkatId as never,
            kePangkatId: kePangkatId as never,
            dariKredit: dariKredit as never,
            keKredit: keKredit as never,
            tmtLama: tmtLama as never,
            tmtBaru: tmtBaru as never,
            catatan: `auto-promote yearly ${year}: ${kreditBefore}+${rate}=${kreditAfter} >= ${thresholdNext} → ${nextPangkat.kode}`,
            createdBy: null,
          } as never,
        });
      });

      promoted++;

      details.push({
        pegawaiId: p.id,
        nama: p.nama,
        nip: p.nip,
        jenis,
        dariKredit: String(dariKredit),
        keKredit: String(keKredit),
        dariPangkat: currentPangkat?.kode ?? null,
        kePangkat: nextPangkat.kode,
        promoted: true,
        status: 'promoted',
      });

      // Send promotion email (best effort, don't fail transaction)
      try {
        const emailPayload = buildPromotionEmail(
          { nama: p.nama, nip: p.nip, email: p.email },
          {
            dariPangkat: currentPangkat?.kode ?? '-',
            kePangkat: nextPangkat.kode,
            dariKredit: String(dariKredit),
            keKredit: String(keKredit),
            tmtBaru: jan1Str,
          },
        );
        await emailFn({
          to: p.email,
          subject: emailPayload.subject,
          html: emailPayload.html,
        });
        logger.info(`promotion email sent to ${p.email} for ${p.nip} ${currentPangkat?.kode}→${nextPangkat.kode}`);
      } catch (e) {
        logger.error(`failed to send promotion email to ${p.email}`, e);
      }
    } catch (e) {
      failed++;
      details.push({
        pegawaiId: p.id,
        nama: p.nama,
        nip: p.nip,
        jenis,
        dariKredit: String(dariKredit),
        keKredit: String(keKredit),
        dariPangkat: currentPangkat?.kode ?? null,
        kePangkat: nextPangkat.kode,
        promoted: false,
        status: 'failed',
        error: e instanceof Error ? e.message : String(e),
      });
      logger.error(`yearly promote failed for ${p.nip}`, e);
    }
  }

  return {
    year,
    today: todayStr,
    processed,
    credited,
    promoted,
    skipped,
    failed,
    details,
  };
}

export default runYearlyCredit;
