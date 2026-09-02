import { prisma } from '@/lib/prisma';
import { normalizeDate, nextKgb, nextKpStruktural, isDueIn60, toISODate } from '@/lib/schedule';
import { getFungsionalDueDate } from '@/lib/credit';
import { sendEmail, buildKgbReminderEmail, buildKpReminderEmail, buildAdminRecapEmail } from '@/lib/notification/email';
import { dispatchWebhook } from '@/lib/notification/webhook';
import { logger } from '@/lib/logger';

export type DueItem = {
  pegawai: {
    id: string;
    nama: string;
    email: string;
    nip: string;
    jenis: string;
    tmtKgb: Date;
    tmtKp: Date;
    kredit: unknown;
    pangkat: { thresholdNext: unknown } | null;
  };
  type: 'KGB' | 'KP';
  dueDate: Date;
};

export function collectDueItems(
  pegawais: DueItem['pegawai'][],
  today: Date,
): DueItem[] {
  const normalizedToday = normalizeDate(today);
  const items: DueItem[] = [];

  for (const p of pegawais) {
    // KGB: tmt_kgb +2y
    const kgbDue = nextKgb(p.tmtKgb);
    if (isDueIn60(kgbDue, normalizedToday)) {
      items.push({ pegawai: p, type: 'KGB', dueDate: kgbDue });
    }

    // KP
    let kpDue: Date | null = null;
    if (p.jenis === 'struktural') {
      kpDue = nextKpStruktural(p.tmtKp);
    } else {
      const threshold = p.pangkat?.thresholdNext ?? null;
      kpDue = getFungsionalDueDate(p.kredit as never, p.jenis, threshold as never, normalizedToday);
    }
    if (kpDue && isDueIn60(kpDue, normalizedToday)) {
      items.push({ pegawai: p, type: 'KP', dueDate: kpDue });
    }
  }

  return items;
}

export interface RunDailyReminderOptions {
  today?: Date;
  prismaClient?: typeof prisma;
  sendEmailFn?: typeof sendEmail;
  dispatchWebhookFn?: typeof dispatchWebhook;
}

export interface DailyReminderResult {
  today: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    pegawaiId: string;
    nama: string;
    email: string;
    type: string;
    dueDate: string;
    channel: string;
    status: 'sent' | 'failed' | 'skipped';
    error?: string;
  }>;
}

async function sendWithRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        logger.warn(`retry attempt ${attempt + 1} failed`, e);
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr;
}

export async function runDailyReminder(
  opts: RunDailyReminderOptions = {},
): Promise<DailyReminderResult> {
  const today = normalizeDate(opts.today ?? new Date());
  const todayStr = toISODate(today);
  const db = opts.prismaClient ?? prisma;
  const emailFn = opts.sendEmailFn ?? sendEmail;
  const webhookFn = opts.dispatchWebhookFn ?? dispatchWebhook;

  // Load pegawai aktif with pangkat
  const pegawais = await db.pegawai.findMany({
    where: { status: 'aktif' },
    include: { pangkat: true },
  });

  const dueItems = collectDueItems(
    pegawais.map((p) => ({
      id: p.id,
      nama: p.nama,
      email: p.email,
      nip: p.nip,
      jenis: p.jenis as string,
      tmtKgb: p.tmtKgb,
      tmtKp: p.tmtKp,
      kredit: p.kredit,
      pangkat: p.pangkat ? { thresholdNext: p.pangkat.thresholdNext } : null,
    })),
    today,
  );

  const webhookUrl = process.env.WEBHOOK_URL ?? '';
  const details: DailyReminderResult['details'] = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  // Process each due item, both channels
  const tasks: Promise<void>[] = [];

  for (const item of dueItems) {
    const dueDateStr = toISODate(item.dueDate);
    const dueDateObj = normalizeDate(item.dueDate);

    // channels to process
    const channels: Array<'email' | 'webhook'> = ['email'];
    if (webhookUrl) channels.push('webhook');

    for (const channel of channels) {
      tasks.push(
        (async () => {
          // idempoten check: existing sent log?
          const existing = await db.notificationLog.findFirst({
            where: {
              pegawaiId: item.pegawai.id,
              type: item.type as never,
              dueDate: dueDateObj as never,
              channel: channel as never,
              status: 'sent' as never,
            },
          });
          if (existing) {
            skipped++;
            details.push({
              pegawaiId: item.pegawai.id,
              nama: item.pegawai.nama,
              email: item.pegawai.email,
              type: item.type,
              dueDate: dueDateStr,
              channel,
              status: 'skipped',
            });
            return;
          }

          // Prepare payload
          const emailPayload =
            item.type === 'KGB'
              ? buildKgbReminderEmail({ nama: item.pegawai.nama, nip: item.pegawai.nip }, item.dueDate)
              : buildKpReminderEmail({ nama: item.pegawai.nama, nip: item.pegawai.nip }, item.dueDate);

          const webhookPayload = {
            pegawaiId: item.pegawai.id,
            nip: item.pegawai.nip,
            nama: item.pegawai.nama,
            email: item.pegawai.email,
            type: item.type,
            dueDate: dueDateStr,
            dueIn: 60,
          };

          let status: 'sent' | 'failed' = 'sent';
          let error: string | undefined;

          try {
            await sendWithRetry(async () => {
              if (channel === 'email') {
                await emailFn({
                  to: item.pegawai.email,
                  subject: emailPayload.subject,
                  html: emailPayload.html,
                });
              } else {
                const res = await webhookFn(webhookPayload);
                if (!res.ok && !res.skipped) {
                  throw new Error(`webhook failed status=${res.status}`);
                }
                if (res.skipped) {
                  // treat skipped webhook as not sent but not failed? we still log sent? skip?
                  // If URL empty but we already added channel only when URL set, this shouldn't happen.
                  throw new Error('webhook skipped no URL');
                }
              }
            }, 1);
          } catch (e) {
            status = 'failed';
            error = e instanceof Error ? e.message : String(e);
          }

          // Write log — use create, catch unique violation as skipped
          const payloadJson =
            channel === 'email'
              ? { subject: emailPayload.subject, to: item.pegawai.email }
              : webhookPayload;

          try {
            await db.notificationLog.create({
              data: {
                pegawaiId: item.pegawai.id,
                type: item.type as never,
                dueDate: dueDateObj as never,
                channel: channel as never,
                status: status as never,
                payload: payloadJson as never,
                error: error ?? null,
              },
            });
          } catch (e: unknown) {
            // P2002 unique violation → already logged by concurrent run, treat as skipped
            const code = (e as { code?: string })?.code;
            if (code === 'P2002') {
              skipped++;
              details.push({
                pegawaiId: item.pegawai.id,
                nama: item.pegawai.nama,
                email: item.pegawai.email,
                type: item.type,
                dueDate: dueDateStr,
                channel,
                status: 'skipped',
              });
              return;
            }
            // other DB error -> count as failed
            logger.error('failed to write notification_log', e);
            status = 'failed';
            error = error ? `${error}; db: ${String(e)}` : String(e);
            // try to write failed log again without unique? but already failed, attempt update
            try {
              await db.notificationLog.create({
                data: {
                  pegawaiId: item.pegawai.id,
                  type: item.type as never,
                  dueDate: dueDateObj as never,
                  channel: channel as never,
                  status: 'failed' as never,
                  payload: payloadJson as never,
                  error: error ?? null,
                },
              });
            } catch {
              // ignore second failure
            }
          }

          if (status === 'sent') sent++;
          else failed++;

          details.push({
            pegawaiId: item.pegawai.id,
            nama: item.pegawai.nama,
            email: item.pegawai.email,
            type: item.type,
            dueDate: dueDateStr,
            channel,
            status,
            error,
          });
        })(),
      );
    }
  }

  // Wait all settled to ensure we capture all results even if some fail
  await Promise.allSettled(tasks);

  // Rekap admin
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    try {
      const recap = buildAdminRecapEmail({
        today: todayStr,
        total: dueItems.length,
        sent,
        failed,
        skipped,
        details: details.map((d) => ({
          nama: d.nama,
          email: d.email,
          type: d.type,
          dueDate: d.dueDate,
          channel: d.channel,
          status: d.status,
        })),
      });
      // retry 1x for admin email too
      await sendWithRetry(
        () =>
          emailFn({
            to: adminEmail,
            subject: recap.subject,
            html: recap.html,
          }),
        1,
      );
      logger.info(`admin recap sent to ${adminEmail}`);
    } catch (e) {
      logger.error('failed to send admin recap', e);
    }
  }

  return {
    today: todayStr,
    total: dueItems.length,
    sent,
    failed,
    skipped,
    details,
  };
}

export default runDailyReminder;
