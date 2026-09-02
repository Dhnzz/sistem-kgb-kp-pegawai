import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail, buildKgbReminderEmail, buildKpReminderEmail } from '@/lib/notification/email';
import { dispatchWebhook } from '@/lib/notification/webhook';

function getRole(session: unknown): string | null {
  return (session as { user?: { role?: string } })?.user?.role ?? null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = getRole(session);
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const id = params.id;
  const log = await prisma.notificationLog.findUnique({
    where: { id },
    include: { pegawai: true },
  });

  if (!log) return NextResponse.json({ error: 'Log tidak ditemukan' }, { status: 404 });

  // Only allow resend for failed logs
  if (log.status === 'sent') {
    return NextResponse.json({ error: 'Log sudah sent, tidak perlu resend' }, { status: 400 });
  }

  const dueDate = new Date(log.dueDate);
  let error: string | null = null;
  let success = false;

  try {
    if (log.channel === 'email') {
      const emailPayload =
        log.type === 'KGB'
          ? buildKgbReminderEmail({ nama: log.pegawai.nama, nip: log.pegawai.nip }, dueDate)
          : buildKpReminderEmail({ nama: log.pegawai.nama, nip: log.pegawai.nip }, dueDate);

      // retry 1x
      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await sendEmail({
            to: log.pegawai.email,
            subject: emailPayload.subject,
            html: emailPayload.html,
          });
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          if (attempt === 0) continue;
          throw lastErr;
        }
      }
      if (lastErr) throw lastErr;
      success = true;
    } else if (log.channel === 'webhook') {
      const payload = {
        pegawaiId: log.pegawai.id,
        nip: log.pegawai.nip,
        nama: log.pegawai.nama,
        email: log.pegawai.email,
        type: log.type,
        dueDate: dueDate.toISOString().slice(0, 10),
        dueIn: 60,
        resend: true,
      };
      let lastErr: unknown;
      let res: { ok: boolean; status?: number; skipped?: boolean } | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await dispatchWebhook(payload);
          if (!res.ok && !res.skipped) throw new Error(`webhook failed status=${res.status}`);
          if (res.skipped) throw new Error('webhook skipped no URL');
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          if (attempt === 0) continue;
          throw lastErr;
        }
      }
      if (lastErr) throw lastErr;
      success = true;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    success = false;
  }

  // Update log status
  const updated = await prisma.notificationLog.update({
    where: { id },
    data: {
      status: success ? ('sent' as never) : ('failed' as never),
      error: error,
      payload: log.payload as never,
    },
  });

  if (success) {
    return NextResponse.json({ ok: true, data: updated, message: 'Resend berhasil' });
  }
  return NextResponse.json({ ok: false, data: updated, error: error ?? 'Resend gagal' }, { status: 502 });
}
