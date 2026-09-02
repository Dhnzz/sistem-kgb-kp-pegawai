import { LoginForm } from '@/components/auth/login-form';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Login — Sistem KGB-KP',
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Masuk</h1>
        <p className="mt-1 text-sm text-slate-600">Sistem KGB-KP Pegawai</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
