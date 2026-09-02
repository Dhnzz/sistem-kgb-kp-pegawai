import * as React from 'react';

export function Button({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
