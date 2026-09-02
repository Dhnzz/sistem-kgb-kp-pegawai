import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    role: 'admin' | 'pegawai' | 'viewer';
    pegawaiId: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: 'admin' | 'pegawai' | 'viewer';
      pegawaiId: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'admin' | 'pegawai' | 'viewer';
    pegawaiId?: string | null;
  }
}
