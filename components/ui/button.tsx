import * as React from 'react';

export function Button({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  // Hindari "kotak putih blank" (bg-white + text-white = tidak terbaca).
  // Jika className sudah membawa bg-* / text-* / hover:bg-*, jangan pakai warna default.
  // Penting: text-xs / text-sm adalah ukuran, bukan warna — jangan dianggap hasTextColor.
  const hasBg = /\bbg-/.test(className);
  const hasTextColor = /\btext-(white|black|transparent|inherit|current|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b/.test(
    className,
  );
  const hasHoverBg = /hover:bg-/.test(className);
  const hasBorder = /\bborder\b/.test(className);

  const baseBg = hasBg ? '' : 'bg-[#2563EB]';
  const baseText = hasTextColor ? '' : 'text-white';
  const baseHover = hasHoverBg ? '' : 'hover:bg-blue-700';
  const baseBorder = hasBorder ? '' : 'border-transparent';

  return (
    <button
      className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${baseBorder} ${baseBg} ${baseText} ${baseHover} ${className}`}
      {...props}
    />
  );
}
