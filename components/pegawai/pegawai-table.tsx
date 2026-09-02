'use client';
import * as React from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type PegawaiRow = {
  id: string;
  nip: string;
  nama: string;
  email: string;
  jenis: string;
  kredit: string | number;
  status: string;
  tmtKgb: string;
  tmtKp: string;
  pangkat: { kode: string; nama: string; id?: string };
  pangkatId?: string;
};

const col = createColumnHelper<PegawaiRow>();

export function PegawaiTable({
  data,
  onEdit,
  onDelete,
  onPromote,
  readOnly,
}: {
  data: PegawaiRow[];
  onEdit: (row: PegawaiRow) => void;
  onDelete: (row: PegawaiRow) => void;
  onPromote?: (row: PegawaiRow) => void;
  readOnly?: boolean;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns = React.useMemo(
    () => [
      col.accessor('nip', { header: 'NIP', cell: (i) => <span className="font-mono text-xs">{i.getValue()}</span> }),
      col.accessor('nama', { header: 'Nama' }),
      col.accessor('email', { header: 'Email', cell: (i) => <span className="text-xs">{i.getValue()}</span> }),
      col.accessor((r) => r.pangkat.kode, { id: 'pangkat', header: 'Pangkat', cell: (i) => i.row.original.pangkat.kode }),
      col.accessor('jenis', {
        header: 'Jenis',
        cell: (i) => (
          <Badge className={i.getValue() === 'struktural' ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700'}>
            {i.getValue()}
          </Badge>
        ),
      }),
      col.accessor('tmtKgb', { header: 'TMT KGB' }),
      col.accessor('tmtKp', { header: 'TMT KP' }),
      col.accessor('kredit', { header: 'Kredit' }),
      col.accessor('status', {
        header: 'Status',
        cell: (i) => (
          <Badge className={i.getValue() === 'aktif' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
            {i.getValue()}
          </Badge>
        ),
      }),
      col.display({
        id: 'aksi',
        header: 'Aksi',
        cell: ({ row }) =>
          readOnly ? (
            <span className="text-xs text-slate-400">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              <Button
                className="h-7 px-2 text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={() => onEdit(row.original)}
              >
                Edit
              </Button>
              {onPromote && (
                <Button
                  className="h-7 px-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100"
                  onClick={() => onPromote(row.original)}
                >
                  Naik
                </Button>
              )}
              <Button
                className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700"
                onClick={() => onDelete(row.original)}
              >
                Hapus
              </Button>
            </div>
          ),
      }),
    ],
    [onEdit, onDelete, onPromote, readOnly],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="space-y-3">
      <div className="overflow-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2 whitespace-nowrap">
                    {h.isPlaceholder ? null : (
                      <span
                        className={h.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-500">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-slate-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">
          Hal {table.getState().pagination.pageIndex + 1} dari {table.getPageCount() || 1} — {data.length} baris
        </span>
        <div className="flex gap-2">
          <Button
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prev
          </Button>
          <Button
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
