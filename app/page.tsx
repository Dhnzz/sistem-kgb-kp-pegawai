import { redirect } from 'next/navigation';
import { RitmeLogo } from '@/components/brand/ritme-logo';

export default function HomePage() {
  redirect('/dashboard');
  return (
    <main className="mx-auto max-w-5xl p-8">
      <RitmeLogo href={null} />
      <p className="mt-3 text-slate-600">
        Pengingat & pencatatan KGB (2 tahun) dan KP (struktural 4 tahun / fungsional kredit) — ritme kenaikan yang tidak pernah terlewat.
      </p>
      <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Bootstrap OK</h2>
        <p className="mt-1 text-sm text-slate-500">
          Next.js 14 + Prisma + Postgres. Lihat{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">docs/spec/SPEC.md</code> untuk detail.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
          <li>Dashboard: /dashboard (T4)</li>
          <li>Pegawai: /pegawai (T3)</li>
          <li>Login: /login (T2)</li>
        </ul>
      </div>
    </main>
  );
}
