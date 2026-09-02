import * as React from 'react';
export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${className}`}
      {...props}
    />
  );
}
export function Label({ className = '', ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`text-sm font-medium text-slate-700 ${className}`} {...props} />;
}
export function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
