'use client';

import { signOut } from 'next-auth/react';
import { ROLE_LABEL, type Role } from '@/lib/rbac';

type TopbarProps = {
  email: string;
  role: Role;
};

export function Topbar({ email, role }: TopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">{email}</span>
        <span className="hidden rounded-full border px-2 py-0.5 text-xs text-slate-600 md:inline-flex">
          {ROLE_LABEL[role]}
        </span>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="rounded-md border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        aria-label="Logout"
      >
        Logout
      </button>
    </header>
  );
}
