import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import type { Role } from '@/lib/rbac';
import { LogTable } from '@/components/log/log-table';

export default async function LogPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: Role } | undefined)?.role;
  if (role !== 'admin') redirect('/dashboard');
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Log Notifikasi</h1>
      <p className="text-sm text-slate-500">Status sent/failed per pegawai · channel email/webhook · tombol Resend untuk yang gagal.</p>
      <LogTable />
    </div>
  );
}
