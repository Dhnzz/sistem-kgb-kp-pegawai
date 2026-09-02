'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Props = {
  data: Array<{ month: string; label: string; count: number }>;
};

export function KgbBarChart({ data }: Props) {
  if (!data || data.length === 0) {
    return <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">Tidak ada data KGB.</div>;
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">KGB per Bulan (12 bulan ke depan)</h3>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} interval={0} angle={-20} dy={10} height={50} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }}
              formatter={(value: number) => [value, 'Jumlah']}
              labelFormatter={(label: string) => `Bulan: ${label}`}
            />
            <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-500">Hitung KGB jatuh tempo per bulan (TMT KGB +2 tahun).</p>
    </div>
  );
}
