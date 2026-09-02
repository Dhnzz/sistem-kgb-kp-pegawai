'use client';

import dynamic from 'next/dynamic';

export const KgbBarChart = dynamic(() => import('./kgb-bar-chart').then((m) => m.KgbBarChart), {
  ssr: false,
  loading: () => <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">Memuat chart KGB...</div>,
});

export const KpDonutChart = dynamic(() => import('./kp-donut-chart').then((m) => m.KpDonutChart), {
  ssr: false,
  loading: () => <div className="rounded-lg border bg-white p-6 text-sm text-slate-500">Memuat chart KP...</div>,
});
