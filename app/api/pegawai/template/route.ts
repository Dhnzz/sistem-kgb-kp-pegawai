import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateTemplateBuffer } from '@/lib/excel';

function getRole(session: unknown): string | null {
  return (session as { user?: { role?: string } })?.user?.role ?? null;
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = getRole(session);
  if (role === 'pegawai') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const buffer = await generateTemplateBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template-pegawai.xlsx"',
      'Content-Length': String(buffer.length),
    },
  });
}
