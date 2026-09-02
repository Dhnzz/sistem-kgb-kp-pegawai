import ExcelJS from 'exceljs';
import { excelRowSchema } from '@/lib/pegawai-validation';

export const EXCEL_HEADERS = [
  'nip',
  'nama',
  'email',
  'kode_pangkat',
  'jenis',
  'tmt_kgb',
  'tmt_kp',
  'kredit',
] as const;

export type RawExcelRow = Record<(typeof EXCEL_HEADERS)[number], string>;

export type ValidatedRow = RawExcelRow & { rowNumber: number };
export type InvalidRow = { rowNumber: number; data: RawExcelRow; errors: string[] };

export function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // Convert to YYYY-MM-DD
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number') return String(value);
  return String(value).trim();
}

/**
 * Generate template .xlsx buffer for pegawai import.
 * Includes header row with styling + 2 example rows.
 */
export async function generateTemplateBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ritme';
  wb.created = new Date();
  const ws = wb.addWorksheet('Pegawai', {
    properties: { tabColor: { argb: 'FF2563EB' } },
  });

  ws.columns = EXCEL_HEADERS.map((h) => ({ header: h, key: h, width: 20 }));
  // Style header
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  headerRow.commit();

  // Example rows
  ws.addRow({
    nip: '198001012000010001',
    nama: 'Contoh Pegawai',
    email: 'contoh@example.com',
    kode_pangkat: '3A',
    jenis: 'struktural',
    tmt_kgb: '2023-01-01',
    tmt_kp: '2020-01-01',
    kredit: 0,
  });
  ws.addRow({
    nip: '198001012000010002',
    nama: 'Fungsional Muda',
    email: 'muda@example.com',
    kode_pangkat: '3B',
    jenis: 'fungsional_muda',
    tmt_kgb: '2022-06-15',
    tmt_kp: '2021-03-01',
    kredit: 45.5,
  });

  // Add data validation hint row styling for examples
  ws.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }
  });

  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto-filter
  ws.autoFilter = {
    from: 'A1',
    to: `${String.fromCharCode(64 + EXCEL_HEADERS.length)}1`,
  };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * Parse uploaded Excel buffer into raw rows (keyed by header).
 * Expects first row to be headers matching EXCEL_HEADERS (case-insensitive).
 */
export async function parseExcelBuffer(buffer: Buffer): Promise<RawExcelRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Worksheet tidak ditemukan');

  const rows: RawExcelRow[] = [];
  let headerMap: Record<number, string> | null = null;

  ws.eachRow((row, rowNumber) => {
    const values = row.values as unknown[];
    // values[0] is null placeholder
    const cells: string[] = [];
    for (let i = 1; i < values.length; i++) {
      cells.push(normalizeCell((values[i] as { text?: string; result?: unknown } | unknown) ?? ''));
      // Handle rich text / hyperlink objects from exceljs
      const v = values[i] as unknown;
      if (v && typeof v === 'object' && 'text' in (v as Record<string, unknown>)) {
        cells[cells.length - 1] = String((v as { text: string }).text).trim();
      } else if (v && typeof v === 'object' && 'result' in (v as Record<string, unknown>)) {
        const res = (v as { result: unknown }).result;
        cells[cells.length - 1] = normalizeCell(res);
      }
    }

    if (rowNumber === 1) {
      headerMap = {};
      cells.forEach((h, idx) => {
        const colIndex = idx + 1;
        const key = h.toLowerCase().trim();
        // Map to canonical header if matches
        const canonical = EXCEL_HEADERS.find((ch) => ch === key);
        if (canonical) headerMap![colIndex] = canonical;
        else if (key) headerMap![colIndex] = key;
      });
      return;
    }

    if (!headerMap) return;
    const rowObj: Record<string, string> = {};
    // Need to map by column index correctly: iterate over all columns up to EXCEL_HEADERS.length
    // Use row.eachCell alternative: read by column number
    for (let col = 1; col <= EXCEL_HEADERS.length; col++) {
      const header = (headerMap as Record<number, string>)[col] ?? EXCEL_HEADERS[col - 1]!;
      const cell = ws.getRow(rowNumber).getCell(col).value;
      let val: unknown = cell;
      // Unwrap exceljs cell value types
      if (val && typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        if ('text' in obj && typeof obj.text === 'string') val = obj.text;
        else if ('result' in obj) val = obj.result;
        else if ('richText' in obj) {
          const rt = obj.richText as Array<{ text: string }>;
          val = rt.map((r) => r.text).join('');
        }
      }
      rowObj[header] = normalizeCell(val);
    }

    // Skip completely empty rows
    const isEmpty = EXCEL_HEADERS.every((h) => !rowObj[h]);
    if (isEmpty) return;

    const canonicalRow: RawExcelRow = {
      nip: rowObj['nip'] ?? '',
      nama: rowObj['nama'] ?? '',
      email: rowObj['email'] ?? '',
      kode_pangkat: rowObj['kode_pangkat'] ?? '',
      jenis: rowObj['jenis'] ?? '',
      tmt_kgb: rowObj['tmt_kgb'] ?? '',
      tmt_kp: rowObj['tmt_kp'] ?? '',
      kredit: rowObj['kredit'] ?? '',
    };
    rows.push(canonicalRow);
  });

  return rows;
}

export type ValidationContext = {
  pangkatMap: Map<string, string>; // kode -> id
  existingNips: Set<string>;
  existingEmails: Set<string>;
};

/**
 * Validate parsed rows against zod + FK + uniqueness.
 * Returns partitioned valid/invalid rows.
 */
export function validateRows(
  rows: RawExcelRow[],
  ctx: ValidationContext,
): { validRows: ValidatedRow[]; invalidRows: InvalidRow[] } {
  const validRows: ValidatedRow[] = [];
  const invalidRows: InvalidRow[] = [];
  const seenNips = new Set<string>();
  const seenEmails = new Set<string>();

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // header is 1, data starts 2
    const errors: string[] = [];

    const parsed = excelRowSchema.safeParse(row);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${issue.path.join('.')}: ${issue.message}`);
      }
    }

    // FK check pangkat
    if (row.kode_pangkat && !ctx.pangkatMap.has(row.kode_pangkat.toUpperCase())) {
      // also try exact case
      if (!ctx.pangkatMap.has(row.kode_pangkat)) {
        errors.push(`kode_pangkat: pangkat '${row.kode_pangkat}' tidak ditemukan`);
      }
    }

    // Uniqueness DB + file
    const nip = row.nip?.trim();
    const email = row.email?.toLowerCase().trim();
    if (nip) {
      if (ctx.existingNips.has(nip)) errors.push('nip: NIP sudah ada di database');
      if (seenNips.has(nip)) errors.push('nip: NIP duplikat di file');
    }
    if (email) {
      if (ctx.existingEmails.has(email)) errors.push('email: Email sudah ada di database');
      if (seenEmails.has(email)) errors.push('email: Email duplikat di file');
    }

    if (errors.length > 0) {
      invalidRows.push({ rowNumber, data: row, errors });
    } else {
      validRows.push({ ...row, rowNumber } as ValidatedRow);
    }

    if (nip) seenNips.add(nip);
    if (email) seenEmails.add(email);
  });

  return { validRows, invalidRows };
}

/**
 * Generate export workbook for rekap.
 */
export async function generateExportBuffer(
  pegawais: Array<{
    nip: string;
    nama: string;
    email: string;
    pangkatKode: string;
    pangkatNama: string;
    jenis: string;
    tmtKgb: string;
    tmtKp: string;
    kredit: string | number;
    status: string;
  }>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Rekap Pegawai');
  const headers = ['nip', 'nama', 'email', 'kode_pangkat', 'nama_pangkat', 'jenis', 'tmt_kgb', 'tmt_kp', 'kredit', 'status'];
  ws.columns = headers.map((h) => ({ header: h, key: h, width: 18 }));
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  pegawais.forEach((p) => {
    ws.addRow({
      nip: p.nip,
      nama: p.nama,
      email: p.email,
      kode_pangkat: p.pangkatKode,
      nama_pangkat: p.pangkatNama,
      jenis: p.jenis,
      tmt_kgb: p.tmtKgb,
      tmt_kp: p.tmtKp,
      kredit: p.kredit,
      status: p.status,
    });
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}1` };
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function toCsv(
  pegawais: Array<{
    nip: string;
    nama: string;
    email: string;
    pangkatKode: string;
    pangkatNama: string;
    jenis: string;
    tmtKgb: string;
    tmtKp: string;
    kredit: string | number;
    status: string;
  }>,
): string {
  const headers = ['nip', 'nama', 'email', 'kode_pangkat', 'nama_pangkat', 'jenis', 'tmt_kgb', 'tmt_kp', 'kredit', 'status'];
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  for (const p of pegawais) {
    lines.push(
      [
        escape(p.nip),
        escape(p.nama),
        escape(p.email),
        escape(p.pangkatKode),
        escape(p.pangkatNama),
        escape(p.jenis),
        escape(p.tmtKgb),
        escape(p.tmtKp),
        escape(p.kredit),
        escape(p.status),
      ].join(','),
    );
  }
  return lines.join('\n');
}
