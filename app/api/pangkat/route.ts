import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await prisma.pangkat.findMany({ orderBy: { urutan: 'asc' } });
  return NextResponse.json({ data });
}
