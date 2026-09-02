import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type PangkatSeed = {
  kode: string;
  nama: string;
  golongan: string;
  level: number;
  urutan: number;
  thresholdNext: number | null;
};

// 15 pangkat I/a – IV/e (contoh threshold; null untuk puncak IV/e)
const pangkatSeeds: PangkatSeed[] = [
  { kode: '1A', nama: 'Juru Muda', golongan: 'I', level: 1, urutan: 1, thresholdNext: 50 },
  { kode: '1B', nama: 'Juru Muda Tingkat I', golongan: 'I', level: 2, urutan: 2, thresholdNext: 50 },
  { kode: '1C', nama: 'Juru', golongan: 'I', level: 3, urutan: 3, thresholdNext: 50 },
  { kode: '1D', nama: 'Juru Tingkat I', golongan: 'I', level: 4, urutan: 4, thresholdNext: 50 },
  { kode: '2A', nama: 'Pengatur Muda', golongan: 'II', level: 5, urutan: 5, thresholdNext: 75 },
  { kode: '2B', nama: 'Pengatur Muda Tingkat I', golongan: 'II', level: 6, urutan: 6, thresholdNext: 75 },
  { kode: '2C', nama: 'Pengatur', golongan: 'II', level: 7, urutan: 7, thresholdNext: 100 },
  { kode: '2D', nama: 'Pengatur Tingkat I', golongan: 'II', level: 8, urutan: 8, thresholdNext: 100 },
  { kode: '3A', nama: 'Penata Muda', golongan: 'III', level: 9, urutan: 9, thresholdNext: 100 },
  { kode: '3B', nama: 'Penata Muda Tingkat I', golongan: 'III', level: 10, urutan: 10, thresholdNext: 100 },
  { kode: '3C', nama: 'Penata', golongan: 'III', level: 11, urutan: 11, thresholdNext: 150 },
  { kode: '3D', nama: 'Penata Tingkat I', golongan: 'III', level: 12, urutan: 12, thresholdNext: 150 },
  { kode: '4A', nama: 'Pembina', golongan: 'IV', level: 13, urutan: 13, thresholdNext: 200 },
  { kode: '4B', nama: 'Pembina Tingkat I', golongan: 'IV', level: 14, urutan: 14, thresholdNext: 200 },
  { kode: '4C', nama: 'Pembina Utama Muda', golongan: 'IV', level: 15, urutan: 15, thresholdNext: 200 },
  { kode: '4D', nama: 'Pembina Utama Madya', golongan: 'IV', level: 16, urutan: 16, thresholdNext: 200 },
  { kode: '4E', nama: 'Pembina Utama', golongan: 'IV', level: 17, urutan: 17, thresholdNext: null },
];

const firstNames = [
  'Budi', 'Siti', 'Agus', 'Dewi', 'Rudi', 'Ani', 'Joko', 'Sri', 'Hadi', 'Lina',
  'Eko', 'Rina', 'Dedi', 'Maya', 'Fajar', 'Nurul', 'Andi', 'Tuti', 'Yudi', 'Wati',
];
const lastNames = [
  'Santoso', 'Wijaya', 'Pratama', 'Lestari', 'Kusuma', 'Hidayat', 'Saputra', 'Anggraini',
  'Setiawan', 'Permata', 'Nugroho', 'Hartono', 'Susanto', 'Puspita', 'Gunawan', 'Sari',
  'Kurniawan', 'Utami', 'Firmansyah', 'Melati',
];

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function main() {
  console.log('Seeding pangkat...');
  for (const p of pangkatSeeds) {
    await prisma.pangkat.upsert({
      where: { kode: p.kode },
      update: {
        nama: p.nama,
        golongan: p.golongan,
        level: p.level,
        urutan: p.urutan,
        thresholdNext: p.thresholdNext,
      },
      create: {
        kode: p.kode,
        nama: p.nama,
        golongan: p.golongan,
        level: p.level,
        urutan: p.urutan,
        thresholdNext: p.thresholdNext,
      },
    });
  }

  const allPangkat = await prisma.pangkat.findMany({ orderBy: { urutan: 'asc' } });
  console.log(`Seeded ${allPangkat.length} pangkat`);

  // Seed admin user
  const adminEmail = 'admin@example.com';
  const adminPassword = 'Admin123!';
  const hashed = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: hashed, role: 'admin' },
    create: { email: adminEmail, passwordHash: hashed, role: 'admin' },
  });
  console.log(`Seeded admin: ${adminEmail} / ${adminPassword}`);

  // Seed 100 pegawai dummy
  console.log('Seeding pegawai...');
  const jenisOptions: Array<'struktural' | 'fungsional_muda' | 'fungsional_biasa'> = [
    'struktural',
    'fungsional_muda',
    'fungsional_biasa',
  ];

  // Clear existing pegawai for idempotent seed (only if not production)
  const existingCount = await prisma.pegawai.count();
  if (existingCount > 0) {
    console.log(`Found ${existingCount} existing pegawai, skipping bulk create to keep idempotent`);
    // Ensure at least 100 exist; if less, top up
    const needed = 100 - existingCount;
    if (needed <= 0) {
      console.log('Seed complete');
      return;
    }
  }

  const needed = 100 - (await prisma.pegawai.count());
  for (let i = 0; i < needed; i++) {
    const idx = existingCount + i;
    const fn = firstNames[idx % firstNames.length];
    const ln = lastNames[Math.floor(idx / 2) % lastNames.length];
    const nama = `${fn} ${ln} ${idx + 1}`;
    const nip = `198${String(80 + (idx % 25)).padStart(2, '0')}0${String(idx + 1).padStart(3, '0')}000${String(idx).padStart(6, '0')}`.slice(0, 18);
    // Unique nip workaround
    const uniqueNip = `19${String(8000000000000000 + idx).padStart(16, '0')}`.slice(0, 18);
    const email = `pegawai${idx + 1}@example.com`;
    const pangkat = allPangkat[idx % allPangkat.length]!;
    const jenis = jenisOptions[idx % jenisOptions.length]!;

    // Random TMT: KGB within last 2 years, KP within last 4 years
    const now = new Date();
    const tmtKgb = toDateOnly(randomDate(new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()), now));
    const tmtKp = toDateOnly(randomDate(new Date(now.getFullYear() - 4, now.getMonth(), now.getDate()), now));
    const kredit = jenis === 'struktural' ? 0 : Number((Math.random() * 120).toFixed(1));

    try {
      await prisma.pegawai.create({
        data: {
          nip: uniqueNip,
          nama,
          email,
          pangkatId: pangkat.id,
          jenis,
          tmtKgb,
          tmtKp,
          kredit,
          status: 'aktif',
        },
      });
    } catch (e) {
      console.warn(`Skip pegawai ${idx} duplicate:`, (e as Error).message.slice(0, 200));
    }
  }

  const finalCount = await prisma.pegawai.count();
  console.log(`Seeded pegawai total: ${finalCount}`);

  // Create user accounts for first 5 pegawai (for login testing)
  const samplePegawai = await prisma.pegawai.findMany({ take: 5, orderBy: { nip: 'asc' } });
  for (const p of samplePegawai) {
    const pwd = await bcrypt.hash('pegawai123', 10);
    await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        email: p.email,
        passwordHash: pwd,
        role: 'pegawai',
        pegawaiId: p.id,
      },
    });
  }
  console.log('Seeded pegawai users (pegawai123)');

  console.log('Seed done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
