import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { role: string; pegawaiId: string | null };
        (token as unknown as Record<string, unknown>).role = u.role;
        (token as unknown as Record<string, unknown>).pegawaiId = u.pegawaiId;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        const sUser = session.user as unknown as {
          role?: string;
          pegawaiId?: string | null;
          id?: string;
        };
        sUser.role = (token as unknown as Record<string, unknown>).role as string;
        sUser.pegawaiId =
          ((token as unknown as Record<string, unknown>).pegawaiId as string | null) ?? null;
        sUser.id = token.sub as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
