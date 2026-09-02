import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import type { Role } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PangkatManager } from '@/components/pangkat/pangkat-manager';

export default async function PangkatPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: Role } | undefined)?.role;
  if (role !== 'admin') redirect('/dashboard');

  const pangkat = await prisma.pangkat.findMany({ orderBy: { urutan: 'asc' } });
  const initial = pangkat.map((p) => ({
    id: p.id,
    kode: p.kode,
    nama: p.nama,
    golongan: p.golongan,
    level: p.level,
    urutan: p.urutan,
    thresholdNext: p.thresholdNext === null ? null : String(p.thresholdNext),
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Master Pangkat</h1>
      <p className="text-sm text-slate-500">Kelola threshold kredit per jenjang (dipakai engine fungsional). Hanya admin dapat edit.</p>
      <PangkatManager initial={initial} />
    </div>
  );
}
