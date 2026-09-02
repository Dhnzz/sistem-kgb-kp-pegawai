'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type LogRow = {
  id: string;
  pegawai: { id: string; nip: string; nama: string; email: string };
  type: 'KGB' | 'KP';
  dueDate: string;
  channel: 'email' | 'webhook';
  status: 'sent' | 'failed';
  payload: unknown;
  error: string | null;
  sentAt: string;
};

function formatDate(s: string): string {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDue(s: string): string {
  if (!s) return '-';
  return s.slice(0, 10);
}

export function LogTable() {
  const [rows, setRows] = React.useState<LogRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<string>('all');
  const [channel, setChannel] = React.useState<string>('all');
  const [type, setType] = React.useState<string>('all');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [resending, setResending] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status !== 'all') params.set('status', status);
      if (channel !== 'all') params.set('channel', channel);
      if (type !== 'all') params.set('type', type);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await fetch(`/api/log?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Gagal memuat log');
        setRows([]);
        setTotal(0);
        return;
      }
      const mapped: LogRow[] = (json.data as unknown[]).map((r: unknown) => {
        const o = r as Record<string, unknown>;
        const pegawai = o.pegawai as Record<string, unknown> | null;
        return {
          id: String(o.id),
          pegawai: pegawai
            ? { id: String(pegawai.id), nip: String(pegawai.nip), nama: String(pegawai.nama), email: String(pegawai.email) }
            : { id: '-', nip: '-', nama: '-', email: '-' },
          type: String(o.type) as 'KGB' | 'KP',
          dueDate: String(o.dueDate).slice(0, 10),
          channel: String(o.channel) as 'email' | 'webhook',
          status: String(o.status) as 'sent' | 'failed',
          payload: o.payload,
          error: o.error ? String(o.error) : null,
          sentAt: String(o.sentAt),
        };
      });
      setRows(mapped);
      setTotal(Number(json.total ?? mapped.length));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [search, status, channel, type, page, pageSize]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    setPage(1);
  }, [search, status, channel, type]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleResend(id: string) {
    setResending(id);
    setToast(null);
    try {
      const res = await fetch(`/api/log/${id}/resend`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setToast(json.error ?? 'Resend gagal');
      } else {
        setToast('Resend berhasil');
      }
      await fetchData();
    } catch (e) {
      setToast(String(e));
    } finally {
      setResending(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Cari NIP / nama / email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchData()}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
          aria-label="Filter status"
        >
          <option value="all">Semua status</option>
          <option value="sent">Terkirim</option>
          <option value="failed">Gagal</option>
        </select>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
          aria-label="Filter channel"
        >
          <option value="all">Semua channel</option>
          <option value="email">Email</option>
          <option value="webhook">Webhook</option>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
          aria-label="Filter type"
        >
          <option value="all">Semua type</option>
          <option value="KGB">KGB</option>
          <option value="KP">KP</option>
        </select>
        <Button className="bg-slate-800 hover:bg-slate-900" onClick={fetchData}>
          Cari
        </Button>
        <span className="text-xs text-slate-500">{total} log</span>
      </div>

      {toast && (
        <div className={`rounded px-3 py-2 text-sm ${toast.includes('berhasil') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast}
        </div>
      )}
      {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-3 py-2">Waktu</th>
              <th className="px-3 py-2">Pegawai</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Error</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  Memuat...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  Belum ada log notifikasi.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDate(r.sentAt)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{r.pegawai.nama}</div>
                    <div className="font-mono text-xs text-slate-500">{r.pegawai.nip}</div>
                    <div className="text-xs text-slate-400">{r.pegawai.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={r.type === 'KGB' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}>
                      {r.type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDue(r.dueDate)}</td>
                  <td className="px-3 py-2">
                    <Badge className={r.channel === 'email' ? 'bg-slate-100 text-slate-700' : 'bg-purple-50 text-purple-700 border border-purple-200'}>
                      {r.channel}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {r.status === 'sent' ? (
                      <Badge className="bg-green-50 text-green-700 border border-green-200">Terkirim</Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-700 border border-red-200">Gagal</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[200px] truncate text-xs text-slate-600" title={r.error ?? ''}>
                    {r.error ?? '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.status === 'failed' ? (
                      <Button
                        className="h-7 px-2 text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        disabled={resending === r.id}
                        onClick={() => handleResend(r.id)}
                      >
                        {resending === r.id ? 'Mengirim...' : 'Resend'}
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
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
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
