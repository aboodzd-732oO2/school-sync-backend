// اختبار WebSocket real-time end-to-end
// يتطلب: المستودع + المؤسسة موجودين (من test-admin-flow.sh)

import { io } from 'socket.io-client';

const BASE = 'http://localhost:3002/api/v1';
const SOCKET_URL = 'http://localhost:3002';

let PASS = 0, FAIL = 0;

function check(label, ok) {
  if (ok) { console.log(`✅ ${label}`); PASS++; }
  else { console.log(`❌ ${label}`); FAIL++; }
}

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.success ? data.data.token : null;
}

async function apiGet(path, token) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await res.json();
  return j.success ? j.data : null;
}

function waitFor(socket, event, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       اختبار WebSocket real-time                 ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ─── 1. Login كـ admin ───
  const adminToken = await login('admin@system.com', 'admin123');
  check('admin يسجّل دخول', !!adminToken);
  if (!adminToken) process.exit(1);

  // ─── 2. نبحث عن مؤسسة + مستودع في نفس المحافظة (بدون حساب) ───
  const allInstitutions = await apiGet('/admin/institutions', adminToken) || [];
  const allWarehouses = await apiGet('/admin/warehouses', adminToken) || [];

  let freeInst = null, freeWh = null;
  for (const inst of allInstitutions) {
    if (inst.hasAccount) continue;
    const wh = allWarehouses.find(w => !w.hasAccount && w.governorate === inst.governorate);
    if (wh) { freeInst = inst; freeWh = wh; break; }
  }

  if (!freeInst || !freeWh) {
    console.log('❌ لم نجد مؤسسة + مستودع حرَّين في نفس المحافظة');
    process.exit(1);
  }
  console.log(`   → سيستخدم: ${freeInst.name} (${freeInst.governorate}) + ${freeWh.name} (${freeWh.departmentKey})`);

  // نحذف مستخدمي sockettest إن وُجدوا من تشغيل سابق
  const users = await apiGet('/admin/users', adminToken) || [];
  for (const u of users) {
    if (u.email === 'socktest-inst@x.com' || u.email === 'socktest-wh@x.com') {
      await fetch(`${BASE}/admin/users/${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
    }
  }

  const instRes = await fetch(`${BASE}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ email: 'socktest-inst@x.com', password: 'SockTest1', userType: 'institution', institutionId: freeInst.id }),
  }).then(r => r.json());
  check('إنشاء مؤسسة اختبار sock', instRes.success);

  const whRes = await fetch(`${BASE}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ email: 'socktest-wh@x.com', password: 'SockTest1', userType: 'warehouse', warehouseId: freeWh.id }),
  }).then(r => r.json());
  check('إنشاء مستودع اختبار sock', whRes.success);

  const instToken = await login('socktest-inst@x.com', 'SockTest1');
  const whToken = await login('socktest-wh@x.com', 'SockTest1');

  // ─── 3. Socket auth: invalid token → رفض ───
  let rejected = false;
  try {
    await connectSocket('bad-token-123');
  } catch {
    rejected = true;
  }
  check('socket بتوكن خاطئ مرفوض', rejected);

  // ─── 4. Socket auth: صحيح → يتصل ───
  const whSocket = await connectSocket(whToken).catch(() => null);
  check('socket المستودع يتصل', !!whSocket);

  const instSocket = await connectSocket(instToken).catch(() => null);
  check('socket المؤسسة يتصل', !!instSocket);

  if (!whSocket || !instSocket) process.exit(1);

  // ─── 5. المؤسسة تنشئ طلب → المستودع يستلم request:new فوراً ───
  const requestNewPromise = waitFor(whSocket, 'request:new', 3000);
  const notifPromise = waitFor(whSocket, 'notification:new', 3000);

  const createRes = await fetch(`${BASE}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instToken}` },
    body: JSON.stringify({
      title: 'اختبار sock real-time',
      description: 'اختبار',
      priority: 'high',
      status: 'pending',
      quantity: 1,
      studentsAffected: 0,
      unitType: 'قطعة',
      subcategory: 'test-item',
      departmentKey: freeWh.departmentKey,
    }),
  }).then(r => r.json());
  check('إنشاء طلب عبر HTTP', createRes.success);
  const requestId = createRes.data?.id;

  const receivedNew = await requestNewPromise;
  check('المستودع يستلم request:new فوراً', receivedNew?.id === requestId);

  const receivedNotif = await notifPromise;
  check('المستودع يستلم notification:new', receivedNotif?.type === 'request-new');

  // ─── 6. المستودع يغيّر الحالة → الطرفان يستلمان status-changed ───
  const whStatusPromise = waitFor(whSocket, 'request:status-changed', 3000);
  const instStatusPromise = waitFor(instSocket, 'request:status-changed', 3000);
  const instNotifPromise = waitFor(instSocket, 'notification:new', 3000);

  const statusRes = await fetch(`${BASE}/warehouse/requests/${requestId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${whToken}` },
    body: JSON.stringify({ status: 'in_progress' }),
  }).then(r => r.json());
  check('تغيير الحالة عبر HTTP', statusRes.success);

  const whStatus = await whStatusPromise;
  check('المستودع يستلم status-changed', whStatus?.id === requestId);

  const instStatus = await instStatusPromise;
  check('المؤسسة تستلم status-changed', instStatus?.id === requestId);

  const instNotif = await instNotifPromise;
  check('المؤسسة تستلم notification الحالة', instNotif?.type === 'request-status');

  // ─── 7. تنظيف ───
  whSocket.disconnect();
  instSocket.disconnect();

  const allUsers = await apiGet('/admin/users', adminToken) || [];
  for (const u of allUsers) {
    if (u.email === 'socktest-inst@x.com' || u.email === 'socktest-wh@x.com') {
      await fetch(`${BASE}/admin/users/${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
    }
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║                   الملخص                         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  ✅ ناجح: ${PASS}`);
  console.log(`║  ❌ فاشل: ${FAIL}`);
  console.log(`║  الإجمالي: ${PASS + FAIL}`);
  console.log('╚══════════════════════════════════════════════════╝');

  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('فشل غير متوقع:', err);
  process.exit(1);
});
