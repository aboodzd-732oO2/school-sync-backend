import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const NEON_URL = process.env.NEON_URL;
if (!NEON_URL) { console.error('Missing NEON_URL'); process.exit(1); }

const sql = neon(NEON_URL);

// Test connection
console.log('→ testing HTTP connection to Neon');
const test = await sql`SELECT COUNT(*) as c FROM "Department"`;
console.log(`✓ connected. Departments currently: ${test[0].c}`);

// Read dump file
const dump = readFileSync('C:/Users/ABOOOOD/AppData/Local/Temp/school_sync_data.sql', 'utf8');

// Parse & execute (split by statement — naive but OK for --inserts output)
const statements = dump
  .split('\n')
  .filter(l => l.trim() && !l.startsWith('--') && !l.startsWith('SET ') && !l.startsWith('SELECT pg_catalog.set_config'))
  .join('\n')
  .split(';\n')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`→ ${statements.length} SQL statements to execute`);

// TABLES to truncate (in reverse FK order)
const TRUNCATE_ORDER = [
  'MonthlyReport', 'PasswordResetRequest', 'Notification', 'AuditLog',
  'InventoryItem', 'RequestComment', 'RequestItem', 'Request',
  'User', 'Warehouse', 'Institution',
  'DepartmentItem', 'InstitutionType', 'Priority', 'Unit', 'Department', 'Governorate',
];

console.log('\n→ truncating all data tables on Neon');
for (const t of TRUNCATE_ORDER) {
  try {
    await sql.query(`TRUNCATE "${t}" RESTART IDENTITY CASCADE`);
    console.log(`  🧹 ${t}`);
  } catch (e) {
    console.log(`  ⚠ ${t}: ${e.message.split('\n')[0]}`);
  }
}

console.log('\n→ executing INSERT statements from dump');
let ok = 0, err = 0;
for (const stmt of statements) {
  try {
    await sql.query(stmt);
    ok++;
  } catch (e) {
    err++;
    if (err <= 5) console.error(`  ✗ ${e.message.split('\n')[0]}`);
  }
}
console.log(`\n✓ executed ${ok} statements (${err} errors)`);

// Fix sequences
console.log('\n→ fixing sequences');
for (const t of [...TRUNCATE_ORDER].reverse()) {
  try {
    await sql.query(
      `SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1), true)`
    );
  } catch { /* table may lack id sequence */ }
}

// Final counts
console.log('\n→ final counts on Neon:');
for (const t of ['Governorate', 'Department', 'Institution', 'Warehouse', 'User', 'Request', 'InventoryItem']) {
  const r = await sql.query(`SELECT COUNT(*)::int as c FROM "${t}"`);
  console.log(`  ${t}: ${r[0].c}`);
}
console.log('\n✓ done');
