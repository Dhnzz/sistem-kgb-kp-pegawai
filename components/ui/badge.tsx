import * as React from 'react';
export function Badge({ className = '', ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      {...props}
    />
  );
}
