import { HistoryTable } from '@/components/history/history-table';

export default function RiwayatPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Riwayat Kenaikan</h1>
      <p className="text-sm text-slate-500">Riwayat KGB/KP — auto-promote 1 Jan & konfirmasi manual. Filter jenis & cari NIP/nama.</p>
      <HistoryTable />
    </div>
  );
}
