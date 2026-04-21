import { PrismaClient } from '@prisma/client';

const LOCAL_URL = 'postgresql://postgres:123@localhost:5432/school_sync';
const NEON_URL = process.env.NEON_URL;
if (!NEON_URL) { console.error('Missing NEON_URL env'); process.exit(1); }

const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });
const neon = new PrismaClient({ datasources: { db: { url: NEON_URL } } });

// FK dependency order
const TABLES = [
  'Governorate',
  'Department',
  'InstitutionType',
  'DepartmentItem',
  'Unit',
  'Priority',
  'Institution',
  'Warehouse',
  'User',
  'Request',
  'RequestItem',
  'RequestComment',
  'InventoryItem',
  'AuditLog',
  'Notification',
  'PasswordResetRequest',
  'MonthlyReport',
];

const modelName = (t) => t.charAt(0).toLowerCase() + t.slice(1);

async function main() {
  console.log('→ verify connections');
  await local.$connect();
  await neon.$connect();
  console.log('✓ both connected');

  console.log('\n→ clear Neon tables (reverse FK order)');
  for (const t of [...TABLES].reverse()) {
    try {
      await neon.$executeRawUnsafe(`TRUNCATE "${t}" RESTART IDENTITY CASCADE`);
      console.log(`  🧹 ${t}`);
    } catch (e) {
      console.log(`  ⚠ ${t}: ${e.message.split('\n')[0]}`);
    }
  }

  console.log('\n→ copy data from local → Neon');
  for (const t of TABLES) {
    const m = modelName(t);
    const rows = await local[m].findMany();
    if (rows.length === 0) { console.log(`  · ${t}: empty`); continue; }
    try {
      await neon[m].createMany({ data: rows, skipDuplicates: true });
      console.log(`  ✓ ${t}: ${rows.length} rows`);
    } catch (e) {
      console.error(`  ✗ ${t}: ${e.message.split('\n')[0]}`);
    }
  }

  console.log('\n→ fix sequences');
  for (const t of TABLES) {
    try {
      await neon.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1), true)`
      );
    } catch (e) { /* table may not have id sequence (MonthlyReport composite key etc.) */ }
  }

  console.log('\n✓ migration complete');
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1); })
  .finally(async () => { await local.$disconnect(); await neon.$disconnect(); });
