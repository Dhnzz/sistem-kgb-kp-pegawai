'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type DueRow = {
  id: string;
  nip: string;
  nama: string;
  email: string;
  jenis: string;
  pangkatKode: string;
  pangkatNama: string;
  tmtKgb: string;
  tmtKp: string;
  nextKgb: string;
  nextKp: string;
  daysUntilKgb: number;
  daysUntilKp: number;
  kredit?: string | null;
  thresholdNext?: string | null;
};

type Props = {
  kgbRows: DueRow[];
  kpRows: DueRow[];
};

const PAGE_SIZE_OPTIONS = [5, 10, 20];

function formatDate(s: string): string {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('id-ID');
}

function DaysBadge({ days }: { days: number }) {
  if (days < 0) return <Badge className="bg-red-100 text-red-700">Lewat {Math.abs(days)} hari</Badge>;
  if (days <= 7) return <Badge className="bg-red-50 text-red-700 border border-red-200">{days} hari lagi</Badge>;
  if (days <= 30) return <Badge className="bg-amber-50 text-amber-700 border border-amber-200">{days} hari lagi</Badge>;
  return <Badge className="bg-blue-50 text-blue-700">{days} hari lagi</Badge>;
}

export function DueTable({ kgbRows, kpRows }: Props) {
  const [tab, setTab] = React.useState<'KGB' | 'KP'>('KGB');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);

  const activeRows = tab === 'KGB' ? kgbRows : kpRows;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter(
      (r) =>
        r.nama.toLowerCase().includes(q) ||
        r.nip.includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.pangkatKode.toLowerCase().includes(q),
    );
  }, [activeRows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = React.useMemo(() => {
    const start = safePage * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  React.useEffect(() => {
    setPage(0);
  }, [tab, query, pageSize]);

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('KGB')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === 'KGB' ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            KGB ({kgbRows.length})
          </button>
          <button
            onClick={() => setTab('KP')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === 'KP' ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            KP ({kpRows.length})
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Cari nama / NIP / email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64"
          />
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / hal
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-3 py-2 whitespace-nowrap">NIP / Nama</th>
              <th className="px-3 py-2">Pangkat</th>
              <th className="px-3 py-2">Jenis</th>
              <th className="px-3 py-2">{tab === 'KGB' ? 'TMT KGB' : 'TMT KP'}</th>
              <th className="px-3 py-2">{tab === 'KGB' ? 'Jatuh Tempo KGB' : 'Jatuh Tempo KP'}</th>
              <th className="px-3 py-2">Sisa</th>
              {tab === 'KP' && <th className="px-3 py-2">Kredit</th>}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={tab === 'KP' ? 7 : 6} className="px-3 py-8 text-center text-slate-500">
                  {filtered.length === 0 && activeRows.length > 0
                    ? 'Tidak ada hasil untuk pencarian.'
                    : `Tidak ada yang jatuh tempo 60 hari ke depan 🎉`}
                </td>
              </tr>
            ) : (
              paged.map((r) => {
                const due = tab === 'KGB' ? r.nextKgb : r.nextKp;
                const days = tab === 'KGB' ? r.daysUntilKgb : r.daysUntilKp;
                const tmt = tab === 'KGB' ? r.tmtKgb : r.tmtKp;
                return (
                  <tr key={r.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{r.nama}</div>
                      <div className="font-mono text-xs text-slate-500">{r.nip}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-medium">{r.pangkatKode}</span>
                      <span className="ml-1 text-xs text-slate-500">{r.pangkatNama}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={r.jenis === 'struktural' ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700'}>
                        {r.jenis}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(tmt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{formatDate(due)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <DaysBadge days={days} />
                    </td>
                    {tab === 'KP' && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {r.jenis !== 'struktural' ? (
                          r.kredit !== undefined ? (
                            <span className="flex flex-col gap-1">
                              <span className="font-medium">{r.kredit ?? '-'} / {r.thresholdNext ?? '-'}</span>
                              {r.kredit && r.thresholdNext && Number(r.kredit) + (r.jenis === 'fungsional_muda' ? 25 : 12.5) >= Number(r.thresholdNext) ? (
                                <span className="inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">Diprediksi naik 1 Jan</span>
                              ) : (
                                <span className="text-[10px] text-slate-500">Forecast {(Number(r.kredit ?? 0) + (r.jenis === 'fungsional_muda' ? 25 : 12.5)).toFixed(1)}/{r.thresholdNext}</span>
                              )}
                            </span>
                          ) : (
                            '-'
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-sm">
        <span className="text-slate-600">
          {filtered.length} data • Hal {safePage + 1} dari {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </Button>
          <Button
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
