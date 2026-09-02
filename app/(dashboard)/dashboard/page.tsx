import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { Role } from '@/lib/rbac';
import { nextKgb, nextKpStruktural, isDueIn60, isOverdue, daysUntil, toISODate } from '@/lib/schedule';
import { DueTable, type DueRow } from '@/components/dashboard/due-table';

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
    const nextKpDate = nextKpStruktural(pegawai.tmtKp);
    const kgbDueIn60 = isDueIn60(nextKgbDate);
    const kpDueIn60 = pegawai.jenis === 'struktural' ? isDueIn60(nextKpDate) : false;
    const kgbOverdue = isOverdue(nextKgbDate);
    const kpOverdue = isOverdue(nextKpDate);

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
            <p className="mt-2 text-lg font-bold">{nextKpDate.toLocaleDateString('id-ID')}</p>
            <p className="text-xs text-slate-500">Pangkat: {pegawai.pangkat.kode} — {pegawai.pangkat.nama}</p>
            {pegawai.jenis === 'struktural' && (
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
            {pegawai.jenis !== 'struktural' && (
              <p className="mt-1 text-xs text-slate-500">Fungsional — jadwal KP via kredit (lihat T5)</p>
            )}
          </div>
        </div>
        {pegawai.jenis !== 'struktural' && (
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Kredit</h3>
            <p className="mt-1 text-sm">
              {String(pegawai.kredit)} / {pegawai.pangkat.thresholdNext ? String(pegawai.pangkat.thresholdNext) : '-'}
              {pegawai.pangkat.thresholdNext && (
                <span className="ml-2 text-xs text-slate-500">({pegawai.jenis === 'fungsional_muda' ? '25' : '12.5'} / 1 Jan)</span>
              )}
            </p>
            {pegawai.pangkat.thresholdNext && (
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-[#2563EB]"
                  style={{ width: `${Math.min(100, (Number(pegawai.kredit) / Number(pegawai.pangkat.thresholdNext)) * 100)}%` }}
                />
              </div>
            )}
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
    const np = nextKpStruktural(p.tmtKp);
    const dk = daysUntil(nk);
    const dp = daysUntil(np);
    const overdue = isOverdue(nk) || (p.jenis === 'struktural' && isOverdue(np));
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
      nextKp: formatDateISO(np),
      daysUntilKgb: dk,
      daysUntilKp: dp,
    };

    if (isDueIn60(nk)) kgbDue.push(row);
    // KP only for struktural in T4 (fungsional forecast in T5)
    if (p.jenis === 'struktural' && isDueIn60(np)) kpDue.push(row);
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
          <p className="text-xs text-slate-400">struktural ≤60 hari</p>
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
