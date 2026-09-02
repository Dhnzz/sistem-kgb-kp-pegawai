import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { MobileShell } from '@/components/layout/mobile-shell';
import type { Role } from '@/lib/rbac';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const user = session.user as unknown as { email: string; role: Role; pegawaiId: string | null };
  return (
    <MobileShell role={user.role} email={user.email}>
      {children}
    </MobileShell>
  );
}
