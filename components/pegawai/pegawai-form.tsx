'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { pegawaiFormSchema, type PegawaiFormInput } from '@/lib/pegawai-validation';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';

type Pangkat = { id: string; kode: string; nama: string };

export function PegawaiForm({
  defaultValues,
  pegawaiId,
  onSuccess,
  onCancel,
  pangkats,
}: {
  defaultValues?: Partial<PegawaiFormInput>;
  pegawaiId?: string;
  onSuccess: () => void;
  onCancel: () => void;
  pangkats: Pangkat[];
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PegawaiFormInput>({
    resolver: zodResolver(pegawaiFormSchema),
    defaultValues: {
      kredit: 0,
      status: 'aktif',
      jenis: 'struktural',
      ...defaultValues,
    },
  });

  const [serverError, setServerError] = React.useState<string | null>(null);

  const isEdit = !!pegawaiId;

  const onSubmit = async (data: PegawaiFormInput) => {
    setServerError(null);
    const url = isEdit && pegawaiId ? `/api/pegawai/${pegawaiId}` : '/api/pegawai';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setServerError(json.error ?? 'Gagal menyimpan');
      return;
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{serverError}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>NIP (18 digit)</Label>
          <Input {...register('nip')} placeholder="19xxxxxxxxxxxxxx" />
          {errors.nip && <p className="text-xs text-red-600">{errors.nip.message}</p>}
        </div>
        <div>
          <Label>Email</Label>
          <Input {...register('email')} placeholder="nama@example.com" />
          {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
        </div>
      </div>
      <div>
        <Label>Nama</Label>
        <Input {...register('nama')} placeholder="Nama lengkap" />
        {errors.nama && <p className="text-xs text-red-600">{errors.nama.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Pangkat</Label>
          <Select {...register('pangkatId')}>
            <option value="">-- Pilih pangkat --</option>
            {pangkats.map((p) => (
              <option key={p.id} value={p.id}>
                {p.kode} — {p.nama}
              </option>
            ))}
          </Select>
          {errors.pangkatId && <p className="text-xs text-red-600">{errors.pangkatId.message}</p>}
        </div>
        <div>
          <Label>Jenis</Label>
          <Select {...register('jenis')}>
            <option value="struktural">struktural</option>
            <option value="fungsional_muda">fungsional_muda</option>
            <option value="fungsional_biasa">fungsional_biasa</option>
          </Select>
          {errors.jenis && <p className="text-xs text-red-600">{errors.jenis.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>TMT KGB (YYYY-MM-DD)</Label>
          <Input {...register('tmtKgb')} placeholder="2023-01-01" type="date" />
          {errors.tmtKgb && <p className="text-xs text-red-600">{errors.tmtKgb.message}</p>}
        </div>
        <div>
          <Label>TMT KP (YYYY-MM-DD)</Label>
          <Input {...register('tmtKp')} placeholder="2020-01-01" type="date" />
          {errors.tmtKp && <p className="text-xs text-red-600">{errors.tmtKp.message}</p>}
        </div>
        <div>
          <Label>Kredit</Label>
          <Input {...register('kredit')} type="number" step="0.1" />
          {errors.kredit && <p className="text-xs text-red-600">{errors.kredit.message}</p>}
        </div>
      </div>
      <div>
        <Label>Status</Label>
        <Select {...register('status')}>
          <option value="aktif">aktif</option>
          <option value="nonaktif">nonaktif</option>
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" className="bg-slate-200 text-slate-800 hover:bg-slate-300" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan...' : isEdit ? 'Update' : 'Simpan'}
        </Button>
      </div>
    </form>
  );
}
