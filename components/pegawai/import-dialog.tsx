'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

type ValidRow = Record<string, string> & { rowNumber: number };
type InvalidRow = { rowNumber: number; data: Record<string, string>; errors: string[] };

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<{
    validRows: ValidRow[];
    invalidRows: InvalidRow[];
    total: number;
  } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = React.useState(false);

  const downloadTemplate = async () => {
    const res = await fetch('/api/pegawai/template');
    if (!res.ok) {
      alert('Gagal download template');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-pegawai.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/pegawai/import', { method: 'POST', body: fd });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? 'Gagal preview');
      return;
    }
    setPreview({ validRows: json.validRows, invalidRows: json.invalidRows, total: json.total });
  };

  const handleConfirm = async () => {
    if (!file) return;
    setConfirmLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/pegawai/import?confirm=true', { method: 'POST', body: fd });
    const json = await res.json().catch(() => ({}));
    setConfirmLoading(false);
    if (!res.ok) {
      setError(json.error ?? 'Gagal import');
      return;
    }
    onImported();
    onOpenChange(false);
    setFile(null);
    setPreview(null);
    alert(`Berhasil import ${json.inserted} pegawai`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Import Excel Pegawai</DialogTitle>
        <p className="text-sm text-slate-600">Download template, isi 5 baris, upload lalu preview validasi.</p>
      </DialogHeader>

      <div className="space-y-4">
        <Button className="w-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50" onClick={downloadTemplate} type="button">
          Download Template .xlsx
        </Button>

        <div>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>

        <Button onClick={handlePreview} disabled={!file || loading} className="w-full">
          {loading ? 'Memproses...' : 'Preview Validasi'}
        </Button>

        {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

        {preview && (
          <div className="space-y-2">
            <div className="flex gap-2 text-sm">
              <Badge className="bg-green-50 text-green-700">Valid: {preview.validRows.length}</Badge>
              <Badge className="bg-red-50 text-red-700">Gagal: {preview.invalidRows.length}</Badge>
              <span className="text-slate-500">Total {preview.total}</span>
            </div>

            {preview.invalidRows.length > 0 && (
              <div className="max-h-40 overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-1 text-left">Baris</th>
                      <th className="px-2 py-1 text-left">NIP</th>
                      <th className="px-2 py-1 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.invalidRows.map((r) => (
                      <tr key={r.rowNumber} className="border-t">
                        <td className="px-2 py-1">{r.rowNumber}</td>
                        <td className="px-2 py-1 font-mono">{r.data.nip}</td>
                        <td className="px-2 py-1 text-red-600">{r.errors.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preview.validRows.length > 0 && (
              <div className="max-h-32 overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-1 text-left">Baris</th>
                      <th className="px-2 py-1 text-left">NIP</th>
                      <th className="px-2 py-1 text-left">Nama</th>
                      <th className="px-2 py-1 text-left">Pangkat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.validRows.map((r) => (
                      <tr key={r.rowNumber} className="border-t">
                        <td className="px-2 py-1">{r.rowNumber}</td>
                        <td className="px-2 py-1 font-mono">{r.nip}</td>
                        <td className="px-2 py-1">{r.nama}</td>
                        <td className="px-2 py-1">{r.kode_pangkat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button
              onClick={handleConfirm}
              disabled={preview.validRows.length === 0 || confirmLoading}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {confirmLoading ? 'Mengimpor...' : `Konfirmasi Import ${preview.validRows.length} baris`}
            </Button>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button className="bg-slate-200 text-slate-800 hover:bg-slate-300" onClick={() => onOpenChange(false)} type="button">
          Tutup
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
