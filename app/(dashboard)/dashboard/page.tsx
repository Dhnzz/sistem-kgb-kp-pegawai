import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { Role } from '@/lib/rbac';
import { nextKgb, nextKpStruktural, isDueIn60, isOverdue, daysUntil, toISODate } from '@/lib/schedule';
import { getFungsionalDueDate, isFungsionalDueIn60, getCreditRate, getNextJan1 } from '@/lib/credit';
import { DueTable, type DueRow } from '@/components/dashboard/due-table';
import { CreditProgressBar } from '@/components/credit/credit-progress-bar';
import { ForecastBadge } from '@/components/credit/forecast-badge';

function formatDateISO(d: Date): string {
  return toISODate(d);
}

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as unknown as
    | { email: string; role: Role; pegawaiId: string | null; id: string }
    | undefined;
  const role = user?.role ?? 'viewer';

  if (role === 'pegawai') {
    if (!user?.pegawaiId) {
      return (
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Dashboard Pegawai</h1>
          <p className="text-sm text-slate-600">Akun Anda belum terhubung ke data pegawai. Hubungi admin.</p>
          <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">Email: {user?.email}</div>
        </div>
      );
    }
    const pegawai = await prisma.pegawai.findUnique({
      where: { id: user.pegawaiId },
      include: { pangkat: true },
    });
    if (!pegawai) return <p className="text-sm text-red-600">Data pegawai tidak ditemukan.</p>;

    const nextKgbDate = nextKgb(pegawai.tmtKgb);
    const kgbDueIn60 = isDueIn60(nextKgbDate);
    const kgbOverdue = isOverdue(nextKgbDate);

    const isFungsional = pegawai.jenis !== 'struktural';
    const thresholdNext = pegawai.pangkat.thresholdNext as unknown as string | number | null;
    const fungsionalDue = isFungsional ? getFungsionalDueDate(pegawai.kredit as unknown as string, pegawai.jenis, thresholdNext) : null;
    const nextKpStrukt = nextKpStruktural(pegawai.tmtKp);
    const nextKpDate = isFungsional ? fungsionalDue : nextKpStrukt;
    const kpDueIn60 = isFungsional
      ? isFungsionalDueIn60(pegawai.kredit as unknown as string, pegawai.jenis, thresholdNext)
      : isDueIn60(nextKpStrukt);
    const kpOverdue = isFungsional ? (fungsionalDue ? isOverdue(fungsionalDue) : false) : isOverdue(nextKpStrukt);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard Saya</h1>
          <p className="text-sm text-slate-600">Ringkasan jadwal KGB & KP Anda — {pegawai.nama}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">KGB Berikutnya</h2>
            <p className="mt-2 text-lg font-bold">{nextKgbDate.toLocaleDateString('id-ID')}</p>
            <p className="text-xs text-slate-500">TMT terakhir: {new Date(pegawai.tmtKgb).toLocaleDateString('id-ID')}</p>
            <div className="mt-2 text-xs">
              {kgbOverdue ? (
                <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">Lewat {Math.abs(daysUntil(nextKgbDate))} hari</span>
              ) : kgbDueIn60 ? (
                <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Jatuh tempo {daysUntil(nextKgbDate)} hari lagi</span>
              ) : (
                <span className="text-slate-500">{daysUntil(nextKgbDate)} hari lagi</span>
              )}
            </div>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">KP Berikutnya</h2>
            {isFungsional ? (
              <>
                <p className="mt-2 text-lg font-bold">{nextKpDate ? nextKpDate.toLocaleDateString('id-ID') : '—'}</p>
                <p className="text-xs text-slate-500">Pangkat: {pegawai.pangkat.kode} — {pegawai.pangkat.nama}</p>
                <div className="mt-2">
                  <ForecastBadge kredit={String(pegawai.kredit)} jenis={pegawai.jenis} thresholdNext={thresholdNext as string | null} />
                </div>
                {nextKpDate && (
                  <div className="mt-2 text-xs">
                    {kpOverdue ? (
                      <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">Lewat {Math.abs(daysUntil(nextKpDate))} hari</span>
                    ) : kpDueIn60 ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Jatuh tempo {daysUntil(nextKpDate)} hari lagi</span>
                    ) : (
                      <span className="text-slate-500">{daysUntil(nextKpDate)} hari lagi</span>
                    )}
                  </div>
                )}
                {!nextKpDate && <p className="mt-1 text-xs text-slate-500">Belum memenuhi threshold untuk naik</p>}
              </>
            ) : (
              <>
                <p className="mt-2 text-lg font-bold">{nextKpStrukt.toLocaleDateString('id-ID')}</p>
                <p className="text-xs text-slate-500">Pangkat: {pegawai.pangkat.kode} — {pegawai.pangkat.nama}</p>
                <div className="mt-2 text-xs">
                  {kpOverdue ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">Lewat {Math.abs(daysUntil(nextKpStrukt))} hari</span>
                  ) : kpDueIn60 ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Jatuh tempo {daysUntil(nextKpStrukt)} hari lagi</span>
                  ) : (
                    <span className="text-slate-500">{daysUntil(nextKpStrukt)} hari lagi</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {isFungsional && (
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Kredit</h3>
            <p className="mt-1 text-xs text-slate-500">Rate {getCreditRate(pegawai.jenis)} / 1 Jan • Threshold {thresholdNext ? String(thresholdNext) : 'puncak'}</p>
            <div className="mt-3">
              <CreditProgressBar kredit={String(pegawai.kredit)} thresholdNext={thresholdNext as string | null} />
            </div>
          </div>
        )}
        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">Info: Pengingat akan dikirim H-60 via email jika jadwal mendekati.</div>
      </div>
    );
  }

  // Admin & Viewer
  const pegawais = await prisma.pegawai.findMany({
    where: { status: 'aktif' },
    include: { pangkat: true },
    orderBy: { nama: 'asc' },
  });

  const totalPegawai = pegawais.length;
  const kgbDue: DueRow[] = [];
  const kpDue: DueRow[] = [];
  let overdueCount = 0;

  for (const p of pegawais) {
    const nk = nextKgb(p.tmtKgb);
    const dk = daysUntil(nk);
    const isStrukt = p.jenis === 'struktural';
    const threshold = p.pangkat.thresholdNext as unknown as string | number | null;
    let nextKp: Date;
    let dp: number;
    let isKpDue = false;
    let overdueKp = false;
    if (isStrukt) {
      nextKp = nextKpStruktural(p.tmtKp);
      dp = daysUntil(nextKp);
      isKpDue = isDueIn60(nextKp);
      overdueKp = isOverdue(nextKp);
    } else {
      const dueF = getFungsionalDueDate(p.kredit as unknown as string, p.jenis, threshold);
      if (dueF) {
        nextKp = dueF;
        dp = daysUntil(nextKp);
        isKpDue = isFungsionalDueIn60(p.kredit as unknown as string, p.jenis, threshold);
        overdueKp = isOverdue(nextKp);
      } else {
        nextKp = getNextJan1();
        dp = daysUntil(nextKp);
        isKpDue = false;
        overdueKp = false;
      }
    }
    const overdue = isOverdue(nk) || overdueKp;
    if (overdue) overdueCount += 1;

    const row: DueRow = {
      id: p.id,
      nip: p.nip,
      nama: p.nama,
      email: p.email,
      jenis: p.jenis,
      pangkatKode: p.pangkat.kode,
      pangkatNama: p.pangkat.nama,
      tmtKgb: formatDateISO(new Date(p.tmtKgb)),
      tmtKp: formatDateISO(new Date(p.tmtKp)),
      nextKgb: formatDateISO(nk),
      nextKp: formatDateISO(nextKp),
      daysUntilKgb: dk,
      daysUntilKp: dp,
      kredit: String(p.kredit),
      thresholdNext: threshold === null || threshold === undefined ? null : String(threshold),
    };

    if (isDueIn60(nk)) kgbDue.push(row);
    if (isKpDue) kpDue.push(row);
  }

  // sort by daysUntil ascending (soonest first)
  kgbDue.sort((a, b) => a.daysUntilKgb - b.daysUntilKgb);
  kpDue.sort((a, b) => a.daysUntilKp - b.daysUntilKp);

  const isReadOnly = role === 'viewer';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">Ringkasan KGB/KP — {isReadOnly ? 'mode read-only' : 'admin'}</p>
        </div>
        {isReadOnly && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">Viewer — read-only</span>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Total Pegawai</p>
          <p className="mt-1 text-2xl font-bold">{totalPegawai}</p>
          <p className="text-xs text-slate-400">aktif</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">KGB 60 hari</p>
          <p className="mt-1 text-2xl font-bold text-[#2563EB]">{kgbDue.length}</p>
          <p className="text-xs text-slate-400">jatuh tempo ≤60 hari</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">KP 60 hari</p>
          <p className="mt-1 text-2xl font-bold text-[#2563EB]">{kpDue.length}</p>
          <p className="text-xs text-slate-400">struktural+fungsional ≤60 hari</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Lewat</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{overdueCount}</p>
          <p className="text-xs text-slate-400">sudah lewat jatuh tempo</p>
        </div>
      </div>

      <DueTable kgbRows={kgbDue} kpRows={kpDue} />

      {isReadOnly && <p className="text-xs text-amber-600">Tambah/edit dinonaktifkan untuk viewer.</p>}
    </div>
  );
}
