import { describe, it, expect } from 'vitest';
import { canAccess, getNavForRole } from './rbac';

describe('getNavForRole', () => {
  it('admin sees all nav items', () => {
    const nav = getNavForRole('admin');
    expect(nav.map((n) => n.href)).toEqual(
      expect.arrayContaining(['/dashboard', '/pegawai', '/pangkat', '/log']),
    );
    expect(nav.length).toBe(6);
  });

  it('pegawai only sees dashboard and riwayat', () => {
    const nav = getNavForRole('pegawai');
    expect(nav.map((n) => n.href)).toEqual(['/dashboard', '/riwayat']);
  });

  it('viewer sees dashboard, pegawai, rekap, riwayat but not pangkat/log', () => {
    const nav = getNavForRole('viewer');
    const hrefs = nav.map((n) => n.href);
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/pegawai');
    expect(hrefs).toContain('/rekap');
    expect(hrefs).not.toContain('/pangkat');
    expect(hrefs).not.toContain('/log');
  });
});

describe('canAccess', () => {
  it('admin can access pegawai', () => {
    expect(canAccess('admin', '/pegawai')).toBe(true);
  });
  it('pegawai cannot access pegawai', () => {
    expect(canAccess('pegawai', '/pegawai')).toBe(false);
  });
  it('viewer can access pegawai read-only', () => {
    expect(canAccess('viewer', '/pegawai')).toBe(true);
  });
  it('pegawai cannot access pangkat', () => {
    expect(canAccess('pegawai', '/pangkat')).toBe(false);
  });
  it('admin can access pangkat', () => {
    expect(canAccess('admin', '/pangkat')).toBe(true);
  });
  it('viewer cannot access pangkat/log', () => {
    expect(canAccess('viewer', '/pangkat')).toBe(false);
    expect(canAccess('viewer', '/log')).toBe(false);
  });
  it('pegawai can access dashboard', () => {
    expect(canAccess('pegawai', '/dashboard')).toBe(true);
  });
  it('pegawai can access riwayat', () => {
    expect(canAccess('pegawai', '/riwayat')).toBe(true);
  });
  it('login is public', () => {
    expect(canAccess('pegawai', '/login')).toBe(true);
  });
});
