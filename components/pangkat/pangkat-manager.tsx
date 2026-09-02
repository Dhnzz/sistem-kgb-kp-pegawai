'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Pangkat = {
  id: string;
  kode: string;
  nama: string;
  golongan: string;
  level: number;
  urutan: number;
  thresholdNext: string | number | null;
};

type Props = {
  initial: Pangkat[];
};

export function PangkatManager({ initial }: Props) {
  const [rows, setRows] = React.useState<Pangkat[]>(initial);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  function startEdit(row: Pangkat) {
    setEditingId(row.id);
    setEditValue(row.thresholdNext === null || row.thresholdNext === undefined ? '' : String(row.thresholdNext));
    setErr(null);
    setMsg(null);
  }

  async function save(row: Pangkat) {
    setSaving(true);
    setErr(null);
    setMsg(null);
    const trimmed = editValue.trim();
    // empty => null (puncak)
    let thresholdNext: number | null = null;
    if (trimmed !== '') {
      const n = Number(trimmed);
      if (Number.isNaN(n) || n <= 0) {
        setErr('Threshold harus angka >0 atau kosong (null)');
        setSaving(false);
        return;
      }
      thresholdNext = n;
    }

    try {
      const res = await fetch('/api/pangkat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, thresholdNext }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Gagal menyimpan');
        setSaving(false);
        return;
      }
      const updated: Pangkat = json.data;
      // Prisma returns Decimal as string; normalize
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, thresholdNext: updated.thresholdNext as unknown as string | null } : r,
        ),
      );
      setEditingId(null);
      setMsg(`Threshold ${row.kode} → ${thresholdNext === null ? 'null (puncak)' : thresholdNext} tersimpan`);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {msg && <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</div>}
      {err && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <div className="overflow-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-3 py-2">Urutan</th>
              <th className="px-3 py-2">Kode</th>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Gol</th>
              <th className="px-3 py-2">Level</th>
              <th className="px-3 py-2">Threshold_next</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-slate-50">
                <td className="px-3 py-2">{r.urutan}</td>
                <td className="px-3 py-2 font-mono font-medium">{r.kode}</td>
                <td className="px-3 py-2">{r.nama}</td>
                <td className="px-3 py-2">{r.golongan}</td>
                <td className="px-3 py-2">{r.level}</td>
                <td className="px-3 py-2">
                  {editingId === r.id ? (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="kosong = puncak (null)"
                      className="h-8 w-28"
                      autoFocus
                    />
                  ) : r.thresholdNext === null || r.thresholdNext === undefined ? (
                    <Badge className="bg-slate-100 text-slate-600">puncak (null)</Badge>
                  ) : (
                    <span className="font-medium">{String(r.thresholdNext)}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editingId === r.id ? (
                    <div className="flex gap-1">
                      <Button
                        className="bg-[#2563EB] text-white hover:bg-blue-700 h-7 px-3 text-xs"
                        disabled={saving}
                        onClick={() => save(r)}
                      >
                        Simpan
                      </Button>
                      <Button
                        className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 h-7 px-3 text-xs"
                        disabled={saving}
                        onClick={() => setEditingId(null)}
                      >
                        Batal
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 h-7 px-3 text-xs"
                      onClick={() => startEdit(r)}
                    >
                      Edit
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Edit threshold kredit untuk naik ke pangkat berikutnya. Kosongkan untuk puncak (IV/e). Contoh 3C→3D default 150, 3B→3C 100. Simpan akan update via PATCH /api/pangkat.
      </p>
    </div>
  );
}
