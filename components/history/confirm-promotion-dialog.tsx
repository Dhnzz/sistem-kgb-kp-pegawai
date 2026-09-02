'use client';

import * as React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pegawai: { id: string; nama: string; nip: string; pangkatKode: string } | null;
  onSuccess?: () => void;
};

export function ConfirmPromotionDialog({ open, onOpenChange, pegawai, onSuccess }: Props) {
  const [jenis, setJenis] = React.useState<'KGB' | 'KP'>('KP');
  const [tmtBaru, setTmtBaru] = React.useState<string>(() => {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [catatan, setCatatan] = React.useState('');
  const [pangkats, setPangkats] = React.useState<Array<{ id: string; kode: string; nama: string }>>([]);
  const [kePangkatId, setKePangkatId] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      fetch('/api/pangkat')
        .then((r) => r.json())
        .then((j) => {
          if (j.data) setPangkats(j.data);
        })
        .catch(() => {});
      setError(null);
      setMsg(null);
    }
  }, [open]);

  async function handleSubmit() {
    if (!pegawai) return;
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        jenis,
        catatan: catatan || undefined,
      };
      if (tmtBaru) payload.tmtBaru = tmtBaru;
      if (jenis === 'KP' && kePangkatId) payload.kePangkatId = kePangkatId;

      const res = await fetch(`/api/pegawai/${pegawai.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Gagal konfirmasi');
        setSaving(false);
        return;
      }
      setMsg(`Berhasil konfirmasi ${jenis} untuk ${pegawai.nama}`);
      onSuccess?.();
      setTimeout(() => {
        onOpenChange(false);
        setMsg(null);
      }, 800);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Konfirmasi Naik — {pegawai ? `${pegawai.nama} (${pegawai.nip})` : ''}</DialogTitle>
        <p className="text-xs text-slate-500">Pangkat saat ini: {pegawai?.pangkatKode ?? '-'} • Pilih jenis KGB/KP dan TMT baru.</p>
      </DialogHeader>

      {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {msg && <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</div>}

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-700">Jenis Kenaikan</label>
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setJenis('KGB')}
              className={`rounded-md px-4 py-2 text-sm font-medium ${jenis === 'KGB' ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              KGB
            </button>
            <button
              onClick={() => setJenis('KP')}
              className={`rounded-md px-4 py-2 text-sm font-medium ${jenis === 'KP' ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              KP
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {jenis === 'KGB' ? 'KGB: update TMT KGB saja, kredit tidak reset.' : 'KP: kredit reset 0, pangkat naik, TMT KP baru.'}
          </p>
        </div>

        {jenis === 'KP' && (
          <div>
            <label className="text-xs font-medium text-slate-700">Pangkat Tujuan (opsional — kosong = naik 1 tingkat)</label>
            <select
              value={kePangkatId}
              onChange={(e) => setKePangkatId(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
            >
              <option value="">Otomatis naik 1 tingkat</option>
              {pangkats.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.kode} — {p.nama}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-slate-700">TMT Baru (YYYY-MM-DD)</label>
          <Input value={tmtBaru} onChange={(e) => setTmtBaru(e.target.value)} placeholder="2026-01-01" className="mt-1" />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700">Catatan (opsional)</label>
          <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="SK nomor ... / keterangan" className="mt-1" />
        </div>
      </div>

      <DialogFooter>
        <Button className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => onOpenChange(false)} disabled={saving}>
          Batal
        </Button>
        <Button onClick={handleSubmit} disabled={saving || !pegawai}>
          {saving ? 'Menyimpan...' : `Konfirmasi ${jenis}`}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
