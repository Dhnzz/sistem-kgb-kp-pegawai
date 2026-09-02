import { describe, it, expect } from 'vitest';
import { generateTemplateBuffer, parseExcelBuffer, validateRows, generateExportBuffer, toCsv } from './excel';

describe('excel template generation', () => {
  it('generates non-empty xlsx buffer', async () => {
    const buf = await generateTemplateBuffer();
    expect(buf.length).toBeGreaterThan(1000);
    // XLSX magic: PK zip
    expect(buf.slice(0, 2).toString()).toBe('PK');
  });

  it('parse generated template returns 2 example rows', async () => {
    const buf = await generateTemplateBuffer();
    const rows = await parseExcelBuffer(buf);
    expect(rows.length).toBe(2);
    expect(rows[0]!.nip).toBe('198001012000010001');
    expect(rows[0]!.kode_pangkat).toBe('3A');
  });

  it('round-trip parse validates correctly', async () => {
    const buf = await generateTemplateBuffer();
    const rows = await parseExcelBuffer(buf);
    const pangkatMap = new Map([
      ['3A', 'id-3a'],
      ['3B', 'id-3b'],
    ]);
    const { validRows, invalidRows } = validateRows(rows, {
      pangkatMap,
      existingNips: new Set(),
      existingEmails: new Set(),
    });
    expect(validRows.length).toBe(2);
    expect(invalidRows.length).toBe(0);
  });
});

describe('validateRows', () => {
  const pangkatMap = new Map([
    ['3A', 'id-3a'],
    ['3B', 'id-3b'],
  ]);

  it('detects invalid NIP, email, pangkat FK', () => {
    const rows = [
      { nip: '123', nama: 'A', email: 'bad', kode_pangkat: '9Z', jenis: 'struktural', tmt_kgb: '2023-01-01', tmt_kp: '2020-01-01', kredit: '0' },
      { nip: '198001012000010001', nama: 'B', email: 'b@example.com', kode_pangkat: '3A', jenis: 'struktural', tmt_kgb: 'invalid', tmt_kp: '2020-01-01', kredit: '-1' },
    ] as never;
    const { validRows, invalidRows } = validateRows(rows, {
      pangkatMap,
      existingNips: new Set(),
      existingEmails: new Set(),
    });
    expect(validRows.length).toBe(0);
    expect(invalidRows.length).toBe(2);
    expect(invalidRows[0]!.errors.join(' ')).toContain('NIP');
    expect(invalidRows[0]!.errors.join(' ')).toContain('pangkat');
  });

  it('detects duplicate NIP within file and against DB', () => {
    const rows = [
      { nip: '198001012000010001', nama: 'A', email: 'a@example.com', kode_pangkat: '3A', jenis: 'struktural', tmt_kgb: '2023-01-01', tmt_kp: '2020-01-01', kredit: '0' },
      { nip: '198001012000010001', nama: 'B', email: 'b@example.com', kode_pangkat: '3A', jenis: 'struktural', tmt_kgb: '2023-01-01', tmt_kp: '2020-01-01', kredit: '0' },
      { nip: '198001012000010002', nama: 'C', email: 'a@example.com', kode_pangkat: '3A', jenis: 'struktural', tmt_kgb: '2023-01-01', tmt_kp: '2020-01-01', kredit: '0' },
    ] as never;
    const { validRows, invalidRows } = validateRows(rows, {
      pangkatMap,
      existingNips: new Set(['198001012000010002']),
      existingEmails: new Set(),
    });
    // first row valid, second duplicate nip in file, third duplicate nip in DB + duplicate email in file
    expect(validRows.length).toBe(1);
    expect(invalidRows.length).toBe(2);
  });

  it('accepts valid fungsional rows with kredit', () => {
    const rows = [
      { nip: '198001012000010003', nama: 'Fungsional', email: 'f@example.com', kode_pangkat: '3B', jenis: 'fungsional_muda', tmt_kgb: '2022-06-15', tmt_kp: '2021-03-01', kredit: '45.5' },
    ] as never;
    const { validRows, invalidRows } = validateRows(rows, {
      pangkatMap,
      existingNips: new Set(),
      existingEmails: new Set(),
    });
    expect(validRows.length).toBe(1);
    expect(invalidRows.length).toBe(0);
  });
});

describe('export', () => {
  it('generates export buffer and csv', async () => {
    const data = [
      { nip: '198001012000010001', nama: 'Test', email: 't@example.com', pangkatKode: '3A', pangkatNama: 'Penata Muda', jenis: 'struktural', tmtKgb: '2023-01-01', tmtKp: '2020-01-01', kredit: '0', status: 'aktif' },
    ];
    const buf = await generateExportBuffer(data);
    expect(buf.length).toBeGreaterThan(1000);
    const csv = toCsv(data);
    expect(csv).toContain('nip,nama,email');
    expect(csv).toContain('198001012000010001');
  });
});
