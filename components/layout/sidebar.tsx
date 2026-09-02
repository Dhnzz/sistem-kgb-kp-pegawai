'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getNavForRole, ROLE_LABEL, type Role } from '@/lib/rbac';

type SidebarProps = {
  role: Role;
  email: string;
  onNavigate?: () => void;
};

export function Sidebar({ role, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const nav = getNavForRole(role);

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white">
      <div className="border-b px-6 py-5">
        <h1 className="text-sm font-bold leading-tight text-slate-900">Sistem KGB-KP</h1>
        <p className="text-xs text-slate-500">Kepegawaian</p>
        <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#2563EB]">
          {ROLE_LABEL[role]}
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        {role === 'pegawai' && (
          <p className="px-3 pt-4 text-xs text-slate-400">
            Anda hanya dapat melihat data pribadi.
          </p>
        )}
        {role === 'viewer' && (
          <p className="px-3 pt-4 text-xs text-amber-600">Mode read-only (viewer).</p>
        )}
      </nav>
      <div className="border-t px-4 py-3 text-xs text-slate-400">v1 — {role}</div>
    </aside>
  );
}
