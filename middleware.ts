import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { canAccess } from '@/lib/rbac';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(css|js|png|jpg|svg|ico)$/);

  if (isPublic) return;

  const session = req.auth;
  const isAuthenticated = !!session?.user;

  // Root -> redirect to /dashboard or /login
  if (pathname === '/') {
    if (!isAuthenticated) {
      return Response.redirect(new URL('/login', nextUrl));
    }
    return Response.redirect(new URL('/dashboard', nextUrl));
  }

  if (!isAuthenticated) {
    return Response.redirect(new URL('/login', nextUrl));
  }

  const role = (session.user as unknown as { role: string }).role as
    | 'admin'
    | 'pegawai'
    | 'viewer';
  if (!canAccess(role, pathname)) {
    // Pegawai trying to access admin page -> redirect to their dashboard
    return Response.redirect(new URL('/dashboard', nextUrl));
  }
});

export const config = {
  matcher: ['/((?!api/cron|_next/static|_next/image|favicon.ico).*)'],
};
