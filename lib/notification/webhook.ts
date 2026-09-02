import crypto from 'crypto';

export function computeHmac(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export interface DispatchWebhookOptions {
  url?: string;
  secret?: string;
}

export async function dispatchWebhook(
  payload: object,
  opts: DispatchWebhookOptions = {},
): Promise<{ ok: boolean; status?: number; skipped?: boolean }> {
  const url = opts.url ?? process.env.WEBHOOK_URL;
  if (!url) {
    return { ok: false, skipped: true };
  }
  const secret = opts.secret ?? process.env.WEBHOOK_SECRET ?? '';

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret) {
    const sig = computeHmac(body, secret);
    headers['X-Signature'] = sig;
    // also support lowercase variant for compatibility
    headers['x-signature'] = sig;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  return { ok: res.ok, status: res.status };
}
