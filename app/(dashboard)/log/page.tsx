import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import type { Role } from '@/lib/rbac';

export default async function LogPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: Role } | undefined)?.role;
  if (role !== 'admin') redirect('/dashboard');
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Log Notifikasi</h1>
      <p className="text-sm text-slate-500">Hanya admin.</p>
      <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">Log notifikasi placeholder.</div>
    </div>
  );
}
