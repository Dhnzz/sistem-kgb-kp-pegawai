import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  if (cachedTransporter) return cachedTransporter;

  const port = Number(process.env.SMTP_PORT ?? '587');
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
  return cachedTransporter;
}

// For testing: allow resetting
export function __resetTransporter() {
  cachedTransporter = null;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ messageId: string }> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM ?? 'Ritme <noreply@example.com>';

  // If no SMTP configured, mock success for dev/test
  if (!transporter) {
    // In test, we want to simulate success
    console.log(`[email mock] to=${opts.to} subject=${opts.subject}`);
    return { messageId: `mock-${Date.now()}` };
  }

  const info = await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
  });

  return { messageId: info.messageId ?? `sent-${Date.now()}` };
}

export function buildKgbReminderEmail(pegawai: { nama: string; nip: string }, dueDate: Date): { subject: string; html: string } {
  const dueStr = dueDate.toISOString().slice(0, 10);
  return {
    subject: `[KGB] Pengingat Kenaikan Gaji Berkala — jatuh tempo ${dueStr}`,
    html: `<p>Yth. ${pegawai.nama} (${pegawai.nip}),</p><p>Pengingat: KGB Anda akan jatuh tempo pada <strong>${dueStr}</strong> (H-60). Mohon siapkan berkas.</p><p style="color:#64748B;font-size:12px;margin-top:16px">— Ritme · pengingat KGB & KP tepat waktu</p>`,
  };
}

export function buildKpReminderEmail(pegawai: { nama: string; nip: string }, dueDate: Date): { subject: string; html: string } {
  const dueStr = dueDate.toISOString().slice(0, 10);
  return {
    subject: `[KP] Pengingat Kenaikan Pangkat — jatuh tempo ${dueStr}`,
    html: `<p>Yth. ${pegawai.nama} (${pegawai.nip}),</p><p>Pengingat: Kenaikan Pangkat Anda akan jatuh tempo pada <strong>${dueStr}</strong> (H-60). Mohon siapkan berkas.</p><p style="color:#64748B;font-size:12px;margin-top:16px">— Ritme · pengingat KGB & KP tepat waktu</p>`, 
  };
}

export function buildPromotionEmail(
  pegawai: { nama: string; nip: string; email: string },
  detail: { dariPangkat: string; kePangkat: string; dariKredit: string; keKredit: string; tmtBaru: string },
): { subject: string; html: string } {
  return {
    subject: `[KP] Selamat — Kenaikan Pangkat ${detail.dariPangkat} → ${detail.kePangkat}`,
    html: `<p>Yth. ${pegawai.nama} (${pegawai.nip}),</p><p>Selamat! Kenaikan Pangkat Anda telah diproses otomatis pada <strong>${detail.tmtBaru}</strong>.</p><p>Dari pangkat <strong>${detail.dariPangkat}</strong> (${detail.dariKredit}) → <strong>${detail.kePangkat}</strong> (${detail.keKredit}). Kredit direset ke 0.</p><p style="color:#64748B;font-size:12px;margin-top:16px">— Ritme · pengingat KGB & KP tepat waktu</p>`,
  };
}

export function buildAdminRecapEmail(summary: {
  today: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{ nama: string; email: string; type: string; dueDate: string; channel: string; status: string }>;
}): { subject: string; html: string } {
  const rows = summary.details
    .map(
      (d) =>
        `<tr><td>${d.nama}</td><td>${d.email}</td><td>${d.type}</td><td>${d.dueDate}</td><td>${d.channel}</td><td>${d.status}</td></tr>`,
    )
    .join('');
  return {
    subject: `[Rekap] Cron Harian ${summary.today} — total ${summary.total}, sent ${summary.sent}, failed ${summary.failed}, skipped ${summary.skipped}`,
    html: `<p>Rekap cron harian ${summary.today}</p><p>Total due: ${summary.total}, Sent: ${summary.sent}, Failed: ${summary.failed}, Skipped (idempoten): ${summary.skipped}</p><table border="1" cellpadding="4"><thead><tr><th>Nama</th><th>Email</th><th>Type</th><th>Due</th><th>Channel</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`,
  };
}
