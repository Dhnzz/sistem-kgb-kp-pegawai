'use client';
import * as React from 'react';
import { PegawaiTable, type PegawaiRow } from '@/components/pegawai/pegawai-table';
import { PegawaiForm } from '@/components/pegawai/pegawai-form';
import { ImportDialog } from '@/components/pegawai/import-dialog';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PegawaiFormInput } from '@/lib/pegawai-validation';

type Pangkat = { id: string; kode: string; nama: string };

function formatDate(d: string | Date): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d).slice(0, 10);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const da = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

export function PegawaiClient({ readOnly }: { readOnly: boolean }) {
  const [data, setData] = React.useState<PegawaiRow[]>([]);
  const [pangkats, setPangkats] = React.useState<Pangkat[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<PegawaiRow | null>(null);
  const [showImport, setShowImport] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('pageSize', '100');
    const res = await fetch(`/api/pegawai?${params.toString()}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.data) {
      const mapped: PegawaiRow[] = json.data.map((p: any) => ({
        id: p.id,
        nip: p.nip,
        nama: p.nama,
        email: p.email,
        jenis: p.jenis,
        kredit: String(p.kredit),
        status: p.status,
        tmtKgb: formatDate(p.tmtKgb),
        tmtKp: formatDate(p.tmtKp),
        pangkat: { kode: p.pangkat.kode, nama: p.pangkat.nama, id: p.pangkat.id },
        pangkatId: p.pangkatId,
      }));
      setData(mapped);
    }
    setLoading(false);
  }, [search]);

  const fetchPangkats = React.useCallback(async () => {
    const res = await fetch('/api/pangkat');
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.data) setPangkats(json.data);
  }, []);

  React.useEffect(() => {
    fetchPangkats();
  }, [fetchPangkats]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = (row: PegawaiRow) => {
    setEditing(row);
    setShowForm(true);
  };

  const handleDelete = async (row: PegawaiRow) => {
    if (!confirm(`Hapus ${row.nama} (${row.nip})? Akan di-soft-delete.`)) return;
    const res = await fetch(`/api/pegawai/${row.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? 'Gagal hapus');
      return;
    }
    fetchData();
  };

  const exportExcel = async (format: 'excel' | 'csv') => {
    const res = await fetch(`/api/pegawai/export?format=${format}`);
    if (!res.ok) {
      alert('Gagal export');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'csv' ? 'rekap-pegawai.csv' : 'rekap-pegawai.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {!readOnly && (
            <Button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              Tambah Pegawai
            </Button>
          )}
          <Button
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => setShowImport(true)}
            disabled={readOnly}
          >
            Import Excel
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => exportExcel('excel')}
          >
            Export Excel
          </Button>
          <Button
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => exportExcel('csv')}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Cari NIP / nama / email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchData()}
          className="max-w-sm"
        />
        <Button className="bg-slate-800 hover:bg-slate-900" onClick={fetchData}>
          Cari
        </Button>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">Memuat...</div>
      ) : (
        <PegawaiTable data={data} onEdit={handleEdit} onDelete={handleDelete} readOnly={readOnly} />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Pegawai' : 'Tambah Pegawai'}</DialogTitle>
        </DialogHeader>
        <PegawaiForm
          pangkats={pangkats}
          pegawaiId={editing?.id}
          defaultValues={
            editing
              ? {
                  nip: editing.nip,
                  nama: editing.nama,
                  email: editing.email,
                  pangkatId: editing.pangkatId,
                  jenis: editing.jenis as PegawaiFormInput['jenis'],
                  tmtKgb: editing.tmtKgb,
                  tmtKp: editing.tmtKp,
                  kredit: Number(editing.kredit),
                  status: editing.status as PegawaiFormInput['status'],
                }
              : undefined
          }
          onSuccess={() => {
            setShowForm(false);
            setEditing(null);
            fetchData();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      </Dialog>

      <ImportDialog open={showImport} onOpenChange={setShowImport} onImported={fetchData} />
    </div>
  );
}
