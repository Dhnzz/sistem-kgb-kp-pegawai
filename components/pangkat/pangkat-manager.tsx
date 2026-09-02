'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export function PangkatManager({ initial }: Props) {
  const [rows, setRows] = React.useState<Pangkat[]>(initial);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // tambah pangkat
  const [showAdd, setShowAdd] = React.useState(false);
  const [addForm, setAddForm] = React.useState({ kode: '', nama: '', golongan: '', level: '', urutan: '', thresholdNext: '' });
  const [addSaving, setAddSaving] = React.useState(false);

  // search + pagination
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.kode.toLowerCase().includes(q) ||
        r.nama.toLowerCase().includes(q) ||
        r.golongan.toLowerCase().includes(q) ||
        String(r.urutan).includes(q),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = React.useMemo(() => {
    const start = safePage * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  React.useEffect(() => {
    setPage(0);
  }, [search, pageSize]);

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

  async function handleAdd() {
    setAddSaving(true);
    setErr(null);
    setMsg(null);
    const payload: Record<string, unknown> = {
      kode: addForm.kode.trim(),
      nama: addForm.nama.trim(),
      golongan: addForm.golongan.trim(),
      level: Number(addForm.level),
      urutan: Number(addForm.urutan),
    };
    const t = addForm.thresholdNext.trim();
    if (t !== '') {
      const n = Number(t);
      if (Number.isNaN(n) || n <= 0) {
        setErr('Threshold harus angka >0 atau kosong');
        setAddSaving(false);
        return;
      }
      payload.thresholdNext = n;
    } else {
      payload.thresholdNext = null;
    }
    if (!payload.kode || !payload.nama || !payload.golongan || !payload.level || !payload.urutan) {
      setErr('Kode, nama, golongan, level, urutan wajib diisi');
      setAddSaving(false);
      return;
    }
    try {
      const res = await fetch('/api/pangkat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Gagal menambah pangkat');
        setAddSaving(false);
        return;
      }
      const created: Pangkat = json.data;
      setRows((prev) => [...prev, created].sort((a, b) => a.urutan - b.urutan));
      setMsg(`Pangkat ${created.kode} berhasil ditambah`);
      setShowAdd(false);
      setAddForm({ kode: '', nama: '', golongan: '', level: '', urutan: '', thresholdNext: '' });
    } catch (e) {
      setErr(String(e));
    } finally {
      setAddSaving(false);
    }
  }

  async function handleDelete(row: Pangkat) {
    if (!confirm(`Hapus pangkat ${row.kode} — ${row.nama}?`)) return;
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/pangkat?id=${row.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error || 'Gagal hapus');
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setMsg(`Pangkat ${row.kode} dihapus`);
      if (editingId === row.id) setEditingId(null);
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="space-y-3">
      {msg && <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</div>}
      {err && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowAdd(true)}>
          Tambah Pangkat
        </Button>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Cari kode / nama / gol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64"
          />
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
            aria-label="Jumlah per halaman"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / hal
              </option>
            ))}
          </select>
        </div>
      </div>

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
            {paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  {search ? 'Tidak ada hasil pencarian.' : 'Belum ada pangkat.'}
                </td>
              </tr>
            ) : (
              paged.map((r) => (
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
                          className="bg-[#2563EB] hover:bg-blue-700 text-white h-7 px-3 text-xs"
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
                      <div className="flex gap-1">
                        <Button
                          className="bg-amber-400 hover:bg-amber-500 text-white border-amber-400 h-7 px-3 text-xs"
                          onClick={() => startEdit(r)}
                        >
                          Edit
                        </Button>
                        <Button
                          className="bg-red-600 hover:bg-red-700 text-white h-7 px-3 text-xs"
                          onClick={() => handleDelete(r)}
                        >
                          Hapus
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
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

      <p className="text-xs text-slate-500">
        Edit threshold kredit untuk naik ke pangkat berikutnya. Kosongkan untuk puncak (IV/e). Contoh 3C→3D default 150, 3B→3C 100.
      </p>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogHeader>
          <DialogTitle>Tambah Pangkat</DialogTitle>
          <p className="text-sm text-slate-500">Isi kode, nama, golongan, level, urutan. Threshold kosong = puncak.</p>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Kode *</Label>
            <Input value={addForm.kode} onChange={(e) => setAddForm((p) => ({ ...p, kode: e.target.value }))} placeholder="III/d" />
          </div>
          <div>
            <Label>Golongan *</Label>
            <Input value={addForm.golongan} onChange={(e) => setAddForm((p) => ({ ...p, golongan: e.target.value }))} placeholder="III" />
          </div>
          <div className="col-span-2">
            <Label>Nama *</Label>
            <Input value={addForm.nama} onChange={(e) => setAddForm((p) => ({ ...p, nama: e.target.value }))} placeholder="Penata Tk. I" />
          </div>
          <div>
            <Label>Level *</Label>
            <Input type="number" value={addForm.level} onChange={(e) => setAddForm((p) => ({ ...p, level: e.target.value }))} placeholder="3" />
          </div>
          <div>
            <Label>Urutan *</Label>
            <Input type="number" value={addForm.urutan} onChange={(e) => setAddForm((p) => ({ ...p, urutan: e.target.value }))} placeholder="11" />
          </div>
          <div className="col-span-2">
            <Label>Threshold next (kosong = puncak)</Label>
            <Input value={addForm.thresholdNext} onChange={(e) => setAddForm((p) => ({ ...p, thresholdNext: e.target.value }))} placeholder="150" />
          </div>
        </div>
        <DialogFooter>
          <Button className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => setShowAdd(false)} disabled={addSaving}>
            Batal
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleAdd} disabled={addSaving}>
            {addSaving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
