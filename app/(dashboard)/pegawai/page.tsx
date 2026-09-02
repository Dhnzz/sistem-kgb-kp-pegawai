import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import type { Role } from '@/lib/rbac';

export default async function PegawaiPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: Role } | undefined)?.role;
  if (role === 'pegawai') redirect('/dashboard');
  const readOnly = role === 'viewer';
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Pegawai</h1>
      <p className="text-sm text-slate-600">
        {readOnly ? 'Mode read-only (viewer).' : 'Kelola data pegawai (T3).'}
      </p>
      <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">
        Tabel pegawai akan tampil di T3. {readOnly && 'Tombol tambah/edit disembunyikan.'}
      </div>
    </div>
  );
}
