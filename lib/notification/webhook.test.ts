import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeHmac, dispatchWebhook } from './webhook';

describe('lib/notification/webhook', () => {
  it('computeHmac returns hex sha256', () => {
    const sig = computeHmac('{"hello":"world"}', 'secret123');
    // Known value: hmac SHA256
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    // deterministic
    expect(computeHmac('{"hello":"world"}', 'secret123')).toBe(sig);
    expect(computeHmac('{"hello":"world"}', 'other')).not.toBe(sig);
  });

  it('dispatchWebhook skips when no URL', async () => {
    delete process.env.WEBHOOK_URL;
    const res = await dispatchWebhook({ foo: 'bar' });
    expect(res.skipped).toBe(true);
  });

  it('dispatchWebhook sends POST with HMAC header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    process.env.WEBHOOK_URL = 'https://example.com/hook';
    process.env.WEBHOOK_SECRET = 'mysecret';

    const payload = { pegawaiId: '1', type: 'KGB' };
    const res = await dispatchWebhook(payload, { url: 'https://example.com/hook', secret: 'mysecret' });

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/hook');
    const body = opts.body as string;
    expect(JSON.parse(body)).toEqual(payload);
    const headers = opts.headers as Record<string, string>;
    expect(headers['X-Signature']).toBeDefined();
    expect(headers['X-Signature']).toMatch(/^[a-f0-9]{64}$/);
    // verify HMAC
    const expected = computeHmac(body, 'mysecret');
    expect(headers['X-Signature']).toBe(expected);
  });

  it('dispatchWebhook returns failed when fetch not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    const res = await dispatchWebhook({ x: 1 }, { url: 'https://example.com/hook', secret: '' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });
});
