import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { Role } from '@/lib/rbac';

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as unknown as
    | { email: string; role: Role; pegawaiId: string | null; id: string }
    | undefined;
  const role = user?.role ?? 'viewer';

  if (role === 'pegawai') {
    // Pegawai: dashboard mini sendiri
    if (!user?.pegawaiId) {
      return (
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Dashboard Pegawai</h1>
          <p className="text-sm text-slate-600">
            Akun Anda belum terhubung ke data pegawai. Hubungi admin.
          </p>
          <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">
            Email: {user?.email}
          </div>
        </div>
      );
    }
    const pegawai = await prisma.pegawai.findUnique({
      where: { id: user.pegawaiId },
      include: { pangkat: true },
    });
    if (!pegawai) {
      return <p className="text-sm text-red-600">Data pegawai tidak ditemukan.</p>;
    }
    // Simple nextDue calculation placeholder (full logic in T4 via lib/schedule)
    const nextKgb = new Date(pegawai.tmtKgb);
    nextKgb.setFullYear(nextKgb.getFullYear() + 2);
    const nextKp = new Date(pegawai.tmtKp);
    nextKp.setFullYear(nextKp.getFullYear() + 4);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard Saya</h1>
          <p className="text-sm text-slate-600">
            Ringkasan jadwal KGB & KP Anda — {pegawai.nama}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">KGB Berikutnya</h2>
            <p className="mt-2 text-lg font-bold">{nextKgb.toLocaleDateString('id-ID')}</p>
            <p className="text-xs text-slate-500">TMT terakhir: {new Date(pegawai.tmtKgb).toLocaleDateString('id-ID')}</p>
          </div>
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">KP Berikutnya</h2>
            <p className="mt-2 text-lg font-bold">{nextKp.toLocaleDateString('id-ID')}</p>
            <p className="text-xs text-slate-500">
              Pangkat: {pegawai.pangkat.kode} — {pegawai.pangkat.nama}
            </p>
          </div>
        </div>
        {pegawai.jenis !== 'struktural' && (
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Kredit</h3>
            <p className="mt-1 text-sm">
              {String(pegawai.kredit)} / {pegawai.pangkat.thresholdNext ? String(pegawai.pangkat.thresholdNext) : '-'}
              {pegawai.pangkat.thresholdNext && (
                <span className="ml-2 text-xs text-slate-500">
                  ({pegawai.jenis === 'fungsional_muda' ? '25' : '12.5'} / 1 Jan)
                </span>
              )}
            </p>
            {pegawai.pangkat.thresholdNext && (
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-[#2563EB]"
                  style={{
                    width: `${Math.min(100, (Number(pegawai.kredit) / Number(pegawai.pangkat.thresholdNext)) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          Info: Pengingat akan dikirim H-60 via email jika jadwal mendekati.
        </div>
      </div>
    );
  }

  // Admin & Viewer: full dashboard placeholder (real KPI in T4)
  const totalPegawai = await prisma.pegawai.count({ where: { status: 'aktif' } });
  const isReadOnly = role === 'viewer';
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Ringkasan KGB/KP — {isReadOnly ? 'mode read-only' : 'admin'}
          </p>
        </div>
        {isReadOnly && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            Viewer — read-only
          </span>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Total Pegawai</p>
          <p className="mt-1 text-2xl font-bold">{totalPegawai}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">KGB 60 hari</p>
          <p className="mt-1 text-2xl font-bold">—</p>
          <p className="text-xs text-slate-400">T4: hitung via lib/schedule</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">KP 60 hari</p>
          <p className="mt-1 text-2xl font-bold">—</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Lewat</p>
          <p className="mt-1 text-2xl font-bold">—</p>
        </div>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <h2 className="font-semibold">DueTable (T4)</h2>
        <p className="mt-2 text-sm text-slate-500">
          Tabel KGB/KP 60 hari akan tampil di sini. T2 hanya menyiapkan shell & RBAC.
        </p>
        {isReadOnly && (
          <p className="mt-2 text-xs text-amber-600">Tambah/edit dinonaktifkan untuk viewer.</p>
        )}
      </div>
    </div>
  );
}
