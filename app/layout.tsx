import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ritme — Pengingat KGB & KP Tepat Waktu',
  description: 'Ritme: pengingat & pencatatan Kenaikan Gaji Berkala (KGB) tiap 2 tahun dan Kenaikan Pangkat (KP) — struktural 4 tahun / fungsional kredit — untuk ±100 pegawai. Dashboard H-60, email & webhook, dan riwayat terpusat.',
  icons: {
    icon: '/ritme-icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
