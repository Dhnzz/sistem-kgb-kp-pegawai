import { z } from 'zod';

export const jenisEnum = z.enum(['struktural', 'fungsional_muda', 'fungsional_biasa']);
export const statusEnum = z.enum(['aktif', 'nonaktif']);

function isValidDateString(s: string): boolean {
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export const pegawaiFormSchema = z.object({
  nip: z.string().regex(/^\d{18}$/, 'NIP harus 18 digit angka'),
  nama: z.string().min(1, 'Nama wajib diisi').max(100),
  email: z.string().email('Email tidak valid'),
  pangkatId: z.string().uuid('Pangkat tidak valid'),
  jenis: jenisEnum,
  tmtKgb: z.string().refine(isValidDateString, 'TMT KGB tidak valid (YYYY-MM-DD)'),
  tmtKp: z.string().refine(isValidDateString, 'TMT KP tidak valid (YYYY-MM-DD)'),
  kredit: z.coerce.number().min(0, 'Kredit >=0').default(0),
  status: statusEnum.optional().default('aktif'),
});

export type PegawaiFormInput = z.infer<typeof pegawaiFormSchema>;

// For Excel import — kode_pangkat instead of pangkatId, kredit as string/number
export const excelRowSchema = z.object({
  nip: z.string().regex(/^\d{18}$/, 'NIP harus 18 digit angka'),
  nama: z.string().min(1, 'Nama wajib diisi').max(100),
  email: z.string().email('Email tidak valid'),
  kode_pangkat: z.string().min(1, 'Kode pangkat wajib diisi'),
  jenis: jenisEnum,
  tmt_kgb: z.string().refine(isValidDateString, 'TMT KGB tidak valid (YYYY-MM-DD)'),
  tmt_kp: z.string().refine(isValidDateString, 'TMT KP tidak valid (YYYY-MM-DD)'),
  kredit: z.coerce.number().min(0, 'Kredit >=0'),
});

export type ExcelRowInput = z.infer<typeof excelRowSchema>;
