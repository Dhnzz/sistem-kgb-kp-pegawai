'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type HistoryRow = {
  id: string;
  pegawaiId: string;
  pegawai: { id: string; nip: string; nama: string; email: string };
  jenis: 'KGB' | 'KP';
  dariPangkat: { kode: string; nama: string } | null;
  kePangkat: { kode: string; nama: string } | null;
  dariKredit: string | null;
  keKredit: string | null;
  tmtLama: string | null;
  tmtBaru: string | null;
  catatan: string | null;
  createdAt: string;
  creator: { email: string } | null;
};

function formatDate(s: string | null): string {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString('id-ID');
}

export function HistoryTable() {
  const [rows, setRows] = React.useState<HistoryRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [search, setSearch] = React.useState('');
  const [jenis, setJenis] = React.useState<string>('all');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (jenis !== 'all') params.set('jenis', jenis);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await fetch(`/api/riwayat?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Gagal memuat riwayat');
        setRows([]);
        setTotal(0);
        return;
      }
      const mapped: HistoryRow[] = (json.data as unknown[]).map((h: unknown) => {
        const r = h as Record<string, unknown>;
        const pegawai = r.pegawai as Record<string, unknown> | null;
        const dariP = r.dariPangkat as Record<string, unknown> | null;
        const keP = r.kePangkat as Record<string, unknown> | null;
        const creator = r.creator as Record<string, unknown> | null;
        return {
          id: String(r.id),
          pegawaiId: String(r.pegawaiId),
          pegawai: pegawai
            ? { id: String(pegawai.id), nip: String(pegawai.nip), nama: String(pegawai.nama), email: String(pegawai.email) }
            : { id: String(r.pegawaiId), nip: '-', nama: '-', email: '-' },
          jenis: String(r.jenis) as 'KGB' | 'KP',
          dariPangkat: dariP ? { kode: String(dariP.kode), nama: String(dariP.nama) } : null,
          kePangkat: keP ? { kode: String(keP.kode), nama: String(keP.nama) } : null,
          dariKredit: r.dariKredit === null || r.dariKredit === undefined ? null : String(r.dariKredit),
          keKredit: r.keKredit === null || r.keKredit === undefined ? null : String(r.keKredit),
          tmtLama: r.tmtLama ? String(r.tmtLama).slice(0, 10) : null,
          tmtBaru: r.tmtBaru ? String(r.tmtBaru).slice(0, 10) : null,
          catatan: r.catatan ? String(r.catatan) : null,
          createdAt: String(r.createdAt),
          creator: creator ? { email: String(creator.email) } : null,
        };
      });
      setRows(mapped);
      setTotal(Number(json.total ?? mapped.length));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [search, jenis, page, pageSize]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    setPage(1);
  }, [search, jenis]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Cari NIP / nama..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchData()}
          className="max-w-xs"
        />
        <select
          value={jenis}
          onChange={(e) => setJenis(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
          aria-label="Filter jenis"
        >
          <option value="all">Semua (KGB+KP)</option>
          <option value="KGB">KGB</option>
          <option value="KP">KP</option>
        </select>
        <Button className="bg-slate-800 hover:bg-slate-900" onClick={fetchData}>
          Cari
        </Button>
        <span className="text-xs text-slate-500">{total} riwayat</span>
      </div>

      {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Pegawai</th>
              <th className="px-3 py-2">Jenis</th>
              <th className="px-3 py-2">Dari → Ke</th>
              <th className="px-3 py-2">Kredit</th>
              <th className="px-3 py-2">TMT</th>
              <th className="px-3 py-2">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  Memuat...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  Belum ada riwayat kenaikan.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDate(r.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{r.pegawai.nama}</div>
                    <div className="font-mono text-xs text-slate-500">{r.pegawai.nip}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={r.jenis === 'KGB' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}>
                      {r.jenis}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-mono text-xs">
                      {r.dariPangkat?.kode ?? '-'} → {r.kePangkat?.kode ?? '-'}
                    </span>
                    <div className="text-[11px] text-slate-500">
                      {r.dariPangkat?.nama ?? ''} {r.dariPangkat && r.kePangkat ? '→' : ''} {r.kePangkat?.nama ?? ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {r.dariKredit !== null || r.keKredit !== null ? `${r.dariKredit ?? '-'} → ${r.keKredit ?? '-'}` : '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {r.tmtLama ?? '-'} → {r.tmtBaru ?? '-'}
                  </td>
                  <td className="px-3 py-2 max-w-[200px] truncate text-xs text-slate-600" title={r.catatan ?? ''}>
                    {r.catatan ?? '-'}
                    {r.creator && <div className="text-[11px] text-slate-400">by {r.creator.email}</div>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">
          Hal {page} dari {totalPages} — {total} baris
        </span>
        <div className="flex gap-2">
          <Button
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <Button
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
