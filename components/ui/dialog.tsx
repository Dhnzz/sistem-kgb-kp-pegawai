'use client';
import * as React from 'react';

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-6 shadow-lg">
        {children}
      </div>
    </div>
  );
}
export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 space-y-1">{children}</div>;
}
export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold text-slate-900">{children}</h3>;
}
export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>;
}
