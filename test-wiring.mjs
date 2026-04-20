// test-wiring.mjs — تحقق من صحة الربط Frontend ↔ Backend ↔ DB
// يفحص: كل endpoint يرجع الشكل المتوقع + الحقول اللي يقرأها الفرونت
// فعلياً موجودة + DB consistency بعد العمليات

import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:3002/api/v1';
const prisma = new PrismaClient();

let PASS = 0, FAIL = 0;

function check(label, ok, detail) {
  if (ok) { console.log(`✅ ${label}`); PASS++; }
  else { console.log(`❌ ${label}${detail ? ' — ' + detail : ''}`); FAIL++; }
}

async function login(email, password) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json();
  return d.success ? d.data.token : null;
}

async function get(path, token) {
  const r = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const status = r.status;
  const body = await r.json().catch(() => null);
  return { status, body };
}

function hasKeys(obj, keys) {
  if (!obj || typeof obj !== 'object') return { ok: false, missing: keys };
  const missing = keys.filter(k => !(k in obj));
  return { ok: missing.length === 0, missing };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Frontend ↔ Backend ↔ DB Wiring Audit          ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ─── Setup: نستخدم حسابات من seed ───
  const adminToken = await login('admin@system.com', 'admin123');
  check('Admin login يرجع token', !!adminToken);
  if (!adminToken) { await prisma.$disconnect(); process.exit(1); }

  // نبحث عن institution+warehouse في نفس المحافظة
  const insts = await get('/admin/institutions', adminToken);
  const whs = await get('/admin/warehouses', adminToken);
  let freeInst = null, freeWh = null;
  for (const i of insts.body.data) {
    if (i.hasAccount) continue;
    const w = whs.body.data.find(w => !w.hasAccount && w.governorate === i.governorate);
    if (w) { freeInst = i; freeWh = w; break; }
  }
  if (!freeInst || !freeWh) { console.log('❌ لم نجد inst+wh حرّين'); process.exit(1); }

  // نظّف ثم أنشئ
  await prisma.user.deleteMany({ where: { email: { in: ['wire-inst@test.com', 'wire-wh@test.com'] } } });

  await fetch(`${BASE}/admin/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ email: 'wire-inst@test.com', password: 'WirePass1', userType: 'institution', institutionId: freeInst.id }),
  });
  await fetch(`${BASE}/admin/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ email: 'wire-wh@test.com', password: 'WirePass1', userType: 'warehouse', warehouseId: freeWh.id }),
  });
  const instToken = await login('wire-inst@test.com', 'WirePass1');
  const whToken = await login('wire-wh@test.com', 'WirePass1');

  // ═══ 1. Response envelope: { success, data } ═══
  console.log('\n── Section 1: Response envelope ──');
  const r1 = await get('/governorates', null);
  check('GET /governorates: envelope { success, data }',
    r1.body?.success === true && Array.isArray(r1.body.data));

  const r2 = await get('/auth/me', instToken);
  check('GET /auth/me: envelope { success, data: object }',
    r2.body?.success === true && typeof r2.body.data === 'object' && !Array.isArray(r2.body.data));

  // ═══ 2. Lookup endpoints: الفرونت يتوقع array بحقول محددة ═══
  console.log('\n── Section 2: Lookups ──');
  const lookupExpect = {
    '/governorates': ['id', 'name'],
    '/departments': ['id', 'key', 'labelAr', 'color', 'icon'],
    '/priorities': ['id', 'key', 'labelAr', 'color', 'level'],
    '/institution-types': ['id', 'key', 'labelAr'],
    '/units': ['id', 'name'],
  };
  for (const [path, keys] of Object.entries(lookupExpect)) {
    const { body } = await get(path, null);
    const sample = body?.data?.[0];
    const { ok, missing } = hasKeys(sample, keys);
    check(`${path}: item has ${keys.join(', ')}`, ok, missing.length ? `missing: ${missing}` : '');
  }

  const { body: diBody } = await get('/department-items?departmentKey=materials', null);
  const di = diBody?.data?.[0];
  check('/department-items: item has id, key, labelAr, defaultUnit',
    hasKeys(di, ['id', 'key', 'labelAr', 'defaultUnit']).ok);

  // ═══ 3. Institution Requests: الحقول اللي يقرأها Dashboard/RequestForm ═══
  console.log('\n── Section 3: Requests list shape ──');
  // ننشئ طلب
  const createRes = await fetch(`${BASE}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instToken}` },
    body: JSON.stringify({
      title: 'wiring test', description: 'd', priority: 'high', status: 'pending',
      quantity: 2, studentsAffected: 5, unitType: 'قطعة',
      subcategory: 'wiring-sub', departmentKey: freeWh.departmentKey,
      requestedItems: [{ itemName: 'wire-item', originalKey: 'x', quantity: 2, unitType: 'قطعة', displayText: 'wire-item' }],
    }),
  });
  const createdBody = await createRes.json();
  check('POST /requests returns { success, data }',
    createdBody.success === true && createdBody.data?.id);

  // الحقول اللي يقرأها Index.tsx + Dashboard + RequestsList
  const reqFields = [
    'id', 'title', 'description', 'impact', 'priority', 'status',
    'quantity', 'studentsAffected', 'unitType', 'subcategory',
    'department', 'location', 'schoolLocation', 'routedTo',
    'institutionType', 'institutionName', 'dateSubmitted',
    'requestedItems',
  ];
  const checkFields = hasKeys(createdBody.data, reqFields);
  check(`Request object has all fields the frontend reads`, checkFields.ok,
    checkFields.missing.length ? `missing: ${checkFields.missing.join(', ')}` : '');

  const reqId = createdBody.data.id;

  // requestedItems[0] shape
  const item = createdBody.data.requestedItems?.[0];
  const itemCheck = hasKeys(item, ['itemName', 'originalKey', 'quantity', 'unitType', 'displayText']);
  check('requestedItems item has 5 fields', itemCheck.ok,
    itemCheck.missing.length ? `missing: ${itemCheck.missing.join(', ')}` : '');

  // ═══ 4. DB integrity: بعد create، الطلب فعلياً في DB ═══
  console.log('\n── Section 4: DB integrity ──');
  const dbReq = await prisma.request.findUnique({
    where: { id: parseInt(reqId) },
    include: { requestedItems: true },
  });
  check('Request موجود في DB', !!dbReq);
  check('Request.institutionId = المؤسسة الحالية', dbReq?.institutionId === freeInst.id);
  check('RequestItem مرتبط بالطلب', dbReq?.requestedItems?.length === 1);
  check('RequestItem.quantity = 2', dbReq?.requestedItems?.[0]?.quantity === 2);

  // ═══ 5. Warehouse endpoints: الشكل اللي WarehouseDashboard يقرأه ═══
  console.log('\n── Section 5: Warehouse list shape ──');
  const { body: whList } = await get('/warehouse/requests', whToken);
  const whReq = whList?.data?.find(r => r.id === reqId);
  const whFields = ['id', 'department', 'institutionType', 'institutionName', 'location', 'priority', 'status'];
  const whCheck = hasKeys(whReq, whFields);
  check('Warehouse request has fields WarehouseDashboard reads', whCheck.ok,
    whCheck.missing.length ? `missing: ${whCheck.missing.join(', ')}` : '');

  // ═══ 6. Status update + DB integrity على inventory deduction ═══
  console.log('\n── Section 6: Inventory deduction DB integrity ──');
  // نحضّر عنصر مخزون
  await fetch(`${BASE}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${whToken}` },
    body: JSON.stringify({ name: 'wire-item', category: 'x', quantity: 10, unitType: 'قطعة', minThreshold: 0, department: freeWh.departmentKey }),
  });
  // نقرأ الكمية قبل
  const invBefore = await prisma.inventoryItem.findFirst({
    where: { name: 'wire-item', warehouseId: freeWh.id },
  });
  check('Inventory item created in DB', !!invBefore);

  // نحوّل الحالة in_progress → ready_for_pickup (يخصم)
  await fetch(`${BASE}/warehouse/requests/${reqId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${whToken}` },
    body: JSON.stringify({ status: 'in_progress' }),
  });
  await fetch(`${BASE}/warehouse/requests/${reqId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${whToken}` },
    body: JSON.stringify({ status: 'ready_for_pickup' }),
  });

  const invAfter = await prisma.inventoryItem.findUnique({ where: { id: invBefore.id } });
  check(`Inventory quantity decremented in DB (${invBefore.quantity} → ${invAfter.quantity})`,
    invAfter.quantity === invBefore.quantity - 2);

  // ═══ 7. Pagination: با page يرجع { data, total, page, pageSize }; بدون page يرجع array ═══
  console.log('\n── Section 7: Pagination shape ──');
  const { body: noPage } = await get('/admin/users', adminToken);
  check('/admin/users بدون page: data is array', Array.isArray(noPage?.data));

  const { body: withPage } = await get('/admin/users?page=1&pageSize=2', adminToken);
  check('/admin/users?page=1: data shape = { data, total, page, pageSize }',
    Array.isArray(withPage?.data?.data) &&
    typeof withPage.data.total === 'number' &&
    withPage.data.page === 1);

  // ═══ 8. Notifications: الشكل اللي NotificationBell يتوقعه ═══
  console.log('\n── Section 8: Notifications ──');
  const { body: notifs } = await get('/notifications', whToken);
  check('/notifications: envelope with data + unreadCount + total',
    Array.isArray(notifs?.data?.data) &&
    typeof notifs.data.unreadCount === 'number' &&
    typeof notifs.data.total === 'number');

  const n = notifs?.data?.data?.[0];
  if (n) {
    const nCheck = hasKeys(n, ['id', 'type', 'title', 'read', 'createdAt']);
    check('Notification has { id, type, title, read, createdAt }', nCheck.ok,
      nCheck.missing.length ? `missing: ${nCheck.missing.join(', ')}` : '');
  } else {
    check('Notification sample exists', false, 'no notifications created');
  }

  // ═══ 9. Soft delete integrity ═══
  console.log('\n── Section 9: Soft delete ──');
  // ننشئ مؤسسة اختبار
  const softCreate = await fetch(`${BASE}/admin/institutions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'wire-soft-test', institutionType: 'school', governorate: 'دمشق' }),
  });
  const softBody = await softCreate.json();
  const softId = softBody.data?.id;
  // نحذفها
  await fetch(`${BASE}/admin/institutions/${softId}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` },
  });
  const softInDb = await prisma.institution.findUnique({ where: { id: softId } });
  check('Soft delete: record موجود في DB', !!softInDb);
  check('Soft delete: deletedAt مُعيَّن', softInDb?.deletedAt !== null);

  const softList = await get('/admin/institutions?governorate=' + encodeURIComponent('دمشق'), adminToken);
  const appears = softList.body?.data?.some(i => i.id === softId);
  check('Soft-deleted لا يظهر في القائمة', !appears);
  // hard delete
  await prisma.institution.delete({ where: { id: softId } });

  // ═══ 10. Audit log auto-creation ═══
  console.log('\n── Section 10: Audit log auto-creation ──');
  const auditCountBefore = await prisma.auditLog.count();
  // نُنشئ مستودع
  const auditCreate = await fetch(`${BASE}/admin/institutions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'wire-audit-test', institutionType: 'school', governorate: 'دمشق' }),
  });
  const auditBody = await auditCreate.json();
  const auditId = auditBody.data?.id;
  const auditCountAfter = await prisma.auditLog.count();
  check('Audit log زاد بعد create', auditCountAfter > auditCountBefore);

  const latestAudit = await prisma.auditLog.findFirst({ orderBy: { id: 'desc' } });
  check('Audit log السجل الأخير action=create + entityType=institution',
    latestAudit?.action === 'create' && latestAudit?.entityType === 'institution');
  await prisma.institution.delete({ where: { id: auditId } });

  // ─── تنظيف ───
  await prisma.user.deleteMany({ where: { email: { in: ['wire-inst@test.com', 'wire-wh@test.com'] } } });

  // ─── الملخص ───
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║                   الملخص                         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  ✅ ناجح: ${PASS}`);
  console.log(`║  ❌ فاشل: ${FAIL}`);
  console.log(`║  الإجمالي: ${PASS + FAIL}`);
  console.log('╚══════════════════════════════════════════════════╝');

  await prisma.$disconnect();
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('فشل غير متوقع:', err);
  await prisma.$disconnect();
  process.exit(1);
});
