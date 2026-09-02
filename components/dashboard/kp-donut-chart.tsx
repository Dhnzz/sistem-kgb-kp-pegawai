'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Props = {
  data: Array<{ jenis: string; label: string; count: number; color: string }>;
};

export function KpDonutChart({ data }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const hasData = total > 0;
  // Filter out zero slices for cleaner donut, but keep legend
  const chartData = hasData ? data.filter((d) => d.count > 0) : [{ jenis: 'empty', label: 'Tidak ada KP due 60 hari', count: 1, color: '#E2E8F0' }];

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">KP by Jenis (due 60 hari)</h3>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={hasData ? 2 : 0}
            >
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} stroke="#fff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }}
              formatter={(value: number, name: string) => [value, name]}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">
        {hasData ? `Total ${total} KP jatuh tempo ≤60 hari` : 'Tidak ada KP jatuh tempo 60 hari ke depan'}
      </p>
    </div>
  );
}
