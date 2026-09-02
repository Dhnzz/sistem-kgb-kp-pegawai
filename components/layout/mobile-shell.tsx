'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import type { Role } from '@/lib/rbac';

type Props = {
  role: Role;
  email: string;
  children: React.ReactNode;
};

export function MobileShell({ role, email, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar role={role} email={email} />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button
            aria-label="Close menu"
            className="flex-1 bg-black/30 text-white"
            onClick={() => setOpen(false)}
          />
          <div className="h-full">
            <Sidebar role={role} email={email} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 border-b bg-white px-4 py-2 md:hidden">
          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Menu
          </button>
          <span className="text-sm text-slate-600">{email}</span>
        </div>
        <div className="hidden md:block">
          <Topbar email={email} role={role} />
        </div>
        {/* Mobile topbar logout still accessible via drawer? Add extra logout on mobile header */}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
