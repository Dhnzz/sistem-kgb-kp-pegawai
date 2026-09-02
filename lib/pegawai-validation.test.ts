import { describe, it, expect } from 'vitest';
import { pegawaiFormSchema } from './pegawai-validation';

describe('pegawaiFormSchema', () => {
  const valid = {
    nip: '198001012000010001',
    nama: 'Budi Santoso',
    email: 'budi@example.com',
    pangkatId: '550e8400-e29b-41d4-a716-446655440000',
    jenis: 'struktural' as const,
    tmtKgb: '2023-01-01',
    tmtKp: '2020-01-01',
    kredit: 0,
    status: 'aktif' as const,
  };

  it('accepts valid payload', () => {
    expect(pegawaiFormSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects NIP not 18 digits', () => {
    expect(pegawaiFormSchema.safeParse({ ...valid, nip: '123' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(pegawaiFormSchema.safeParse({ ...valid, email: 'not-email' }).success).toBe(false);
  });

  it('rejects invalid jenis', () => {
    expect(pegawaiFormSchema.safeParse({ ...valid, jenis: 'invalid' as never }).success).toBe(false);
  });

  it('rejects negative kredit', () => {
    expect(pegawaiFormSchema.safeParse({ ...valid, kredit: -1 }).success).toBe(false);
  });

  it('rejects invalid date', () => {
    expect(pegawaiFormSchema.safeParse({ ...valid, tmtKgb: '2023-13-01' }).success).toBe(false);
  });
});
