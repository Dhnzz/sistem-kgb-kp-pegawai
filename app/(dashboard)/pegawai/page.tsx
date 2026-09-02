import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import type { Role } from '@/lib/rbac';
import { PegawaiClient } from '@/components/pegawai/pegawai-client';

export default async function PegawaiPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: Role } | undefined)?.role;
  if (role === 'pegawai') redirect('/dashboard');
  const readOnly = role === 'viewer';
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Pegawai</h1>
      <p className="text-sm text-slate-600">
        {readOnly ? 'Mode read-only (viewer).' : 'Kelola data pegawai — CRUD, import Excel, export rekap.'}
      </p>
      <PegawaiClient readOnly={readOnly} />
    </div>
  );
}
