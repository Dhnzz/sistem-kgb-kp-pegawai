export type Role = 'admin' | 'pegawai' | 'viewer';

export type NavItem = {
  label: string;
  href: string;
  roles: Role[];
  description?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', roles: ['admin', 'pegawai', 'viewer'] },
  { label: 'Pegawai', href: '/pegawai', roles: ['admin', 'viewer'] },
  { label: 'Rekap', href: '/rekap', roles: ['admin', 'viewer'] },
  { label: 'Riwayat', href: '/riwayat', roles: ['admin', 'pegawai', 'viewer'] },
  { label: 'Pangkat', href: '/pangkat', roles: ['admin'] },
  { label: 'Log Notifikasi', href: '/log', roles: ['admin'] },
];

export function getNavForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccess(role: Role, pathname: string): boolean {
  // Allow always: /login, /api/auth, static
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) return true;

  // Normalize: /dashboard, /dashboard/..., /pegawai, etc.
  const matched = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
  );

  // If path is not in NAV_ITEMS but under (dashboard) protected e.g. /dashboard itself, allow by role
  // For unknown protected paths like "/", treat as redirect to dashboard
  if (!matched) {
    // Allow root? Will be handled as redirect; allow all authenticated
    if (pathname === '/' || pathname === '/dashboard') return true;
    // Unknown admin-only path -> deny pegawai
    // Default deny for pegawai if not explicitly allowed
    if (role === 'pegawai') return false;
    // admin/viewer can access other unknown protected paths (future)
    return role === 'admin' || role === 'viewer';
  }

  return matched.roles.includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  pegawai: 'Pegawai',
  viewer: 'Viewer',
};
