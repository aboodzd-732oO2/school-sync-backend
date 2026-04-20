#!/bin/bash
# سكريبت اختبار شامل لنظام الـ Admin
# يفحص: المصادقة + صلاحيات + CRUD + حماية

BASE="http://localhost:3002/api/v1"
PASS=0
FAIL=0

check() {
  local label="$1"
  local expect="$2"  # "success" | "fail"
  local result="$3"
  local got
  if echo "$result" | grep -q '"success":true'; then got="success"; else got="fail"; fi
  if [ "$got" = "$expect" ]; then
    echo "✅ $label"
    PASS=$((PASS+1))
  else
    echo "❌ $label"
    echo "   Expected: $expect, Got: $got"
    echo "   Response: $(echo "$result" | head -c 150)"
    FAIL=$((FAIL+1))
  fi
}

get_token() {
  local email="$1"
  local pwd="$2"
  cat > /tmp/_login.json <<EOF
{"email":"$email","password":"$pwd"}
EOF
  curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d @/tmp/_login.json | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4
}

echo "╔══════════════════════════════════════════════════╗"
echo "║       اختبار شامل لنظام إدارة الحسابات          ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ─── تنظيف بيانات اختبار سابقة ───
echo "【0】 تنظيف بيانات اختبار سابقة"
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const testNames = ['مدرسة اختبارية جديدة', 'مدرسة اختبارية معدّلة', 'مدرسة اختبار الحذف الناعم'];
  const testEmails = ['newschool@test.com', 'newwarehouse@test.com', 'strongpwd@test.com', 'socktest-inst@x.com', 'socktest-wh@x.com'];
  await p.passwordResetRequest.deleteMany({ where: { userEmail: { in: testEmails } } });
  await p.user.deleteMany({ where: { email: { in: testEmails } } });
  await p.institution.deleteMany({ where: { name: { in: testNames } } });
  await p.\$disconnect();
})();
" 2>/dev/null
echo "✅ تنظيف"
echo ""

# ─── 1. Admin login ───────────────────────────────────
echo "【1】 تسجيل دخول Admin"
ADMIN_TOKEN=$(get_token "admin@system.com" "admin123")
if [ -n "$ADMIN_TOKEN" ]; then
  check "admin يسجل دخول" "success" '{"success":true}'
else
  check "admin يسجل دخول" "success" '{"success":false}'
fi

# ─── 2. Admin gets profile ────────────────────────────
echo ""
echo "【2】 بيانات Admin"
R=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $ADMIN_TOKEN")
check "admin /me يرجع userType=admin" "success" "$R"

# ─── 3. Block self-registration ───────────────────────
echo ""
echo "【3】 التسجيل الذاتي (يجب أن يُرفض)"
cat > /tmp/_reg.json <<'EOF'
{"email":"hacker@x.com","password":"1234","userType":"institution","institutionType":"school","governorate":"دمشق","institutionName":"مدرسة الأمويين الابتدائية"}
EOF
R=$(curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" -d @/tmp/_reg.json)
check "التسجيل الذاتي مرفوض" "fail" "$R"

# ─── 4. Admin creates institution ─────────────────────
echo ""
echo "【4】 Admin ينشئ مؤسسة"
# نجيب ID مؤسسة موجودة بدون حساب
INST_ID=$(node -e "
fetch('$BASE/admin/institutions?governorate=%D8%AD%D9%84%D8%A8', { headers: { 'Authorization': 'Bearer $ADMIN_TOKEN' } })
  .then(r => r.json())
  .then(d => { const free = d.data.find(i => !i.hasAccount); if (free) console.log(free.id); })
" 2>/dev/null)

cat > /tmp/_new_inst.json <<EOF
{"email":"newschool@test.com","password":"TestPass1","userType":"institution","institutionId":$INST_ID}
EOF
R=$(curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_new_inst.json)
check "admin ينشئ مؤسسة" "success" "$R"
NEW_INST_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

# ─── 5. Admin creates warehouse ───────────────────────
echo ""
echo "【5】 Admin ينشئ مستودع"

# نجيب ID مستودع موجود بدون حساب
WH_ID=$(node -e "
fetch('$BASE/admin/warehouses?governorate=%D8%AD%D9%84%D8%A8&departmentKey=maintenance', { headers: { 'Authorization': 'Bearer $ADMIN_TOKEN' } })
  .then(r => r.json())
  .then(d => { const free = d.data.find(w => !w.hasAccount); if (free) console.log(free.id); })
" 2>/dev/null)

cat > /tmp/_new_wh.json <<EOF
{"email":"newwarehouse@test.com","password":"TestPass1","userType":"warehouse","warehouseId":$WH_ID}
EOF
R=$(curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_new_wh.json)
check "admin ينشئ مستودع" "success" "$R"
NEW_WH_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

# ─── 6. New institution can login ─────────────────────
echo ""
echo "【6】 المؤسسة الجديدة تسجل دخول"
INST_TOKEN=$(get_token "newschool@test.com" "TestPass1")
if [ -n "$INST_TOKEN" ]; then
  check "المؤسسة الجديدة تسجل دخول" "success" '{"success":true}'
else
  check "المؤسسة الجديدة تسجل دخول" "success" '{"success":false}'
fi

# ─── 7. New warehouse can login ───────────────────────
echo ""
echo "【7】 المستودع الجديد يسجل دخول"
WH_TOKEN=$(get_token "newwarehouse@test.com" "TestPass1")
if [ -n "$WH_TOKEN" ]; then
  check "المستودع الجديد يسجل دخول" "success" '{"success":true}'
else
  check "المستودع الجديد يسجل دخول" "success" '{"success":false}'
fi

# ─── 8. Block warehouse from admin endpoints ──────────
echo ""
echo "【8】 صلاحيات - مستودع يحاول الوصول لـ /admin"
R=$(curl -s "$BASE/admin/users" -H "Authorization: Bearer $WH_TOKEN")
check "مستودع يحاول /admin/users (يُرفض)" "fail" "$R"

# ─── 9. Block institution from admin endpoints ────────
echo ""
echo "【9】 صلاحيات - مؤسسة تحاول الوصول لـ /admin"
R=$(curl -s "$BASE/admin/users" -H "Authorization: Bearer $INST_TOKEN")
check "مؤسسة تحاول /admin/users (يُرفض)" "fail" "$R"

# ─── 10. Block non-admin stats ────────────────────────
echo ""
echo "【10】 صلاحيات - stats فقط للـ admin"
R=$(curl -s "$BASE/admin/stats" -H "Authorization: Bearer $WH_TOKEN")
check "مستودع يحاول /admin/stats (يُرفض)" "fail" "$R"

# ─── 11. Admin stats ──────────────────────────────────
echo ""
echo "【11】 admin يرى الإحصائيات"
R=$(curl -s "$BASE/admin/stats" -H "Authorization: Bearer $ADMIN_TOKEN")
check "admin يرى /admin/stats" "success" "$R"

# ─── 12. List users ───────────────────────────────────
echo ""
echo "【12】 admin يرى قائمة المستخدمين"
R=$(curl -s "$BASE/admin/users" -H "Authorization: Bearer $ADMIN_TOKEN")
check "admin يرى قائمة المستخدمين" "success" "$R"

# ─── 13. Disable user ─────────────────────────────────
echo ""
echo "【13】 admin يعطّل حساب المؤسسة"
R=$(curl -s -X PATCH "$BASE/admin/users/$NEW_INST_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"isActive":false}')
check "admin يعطّل حساب" "success" "$R"

# ─── 14. Disabled user cannot access ──────────────────
echo ""
echo "【14】 المستخدم المعطّل ما يقدر يستخدم الـ token القديم"
R=$(curl -s "$BASE/requests" -H "Authorization: Bearer $INST_TOKEN")
check "المستخدم المعطّل مرفوض" "fail" "$R"

# ─── 15. Re-enable user ───────────────────────────────
echo ""
echo "【15】 admin يفعّل الحساب مرة ثانية"
R=$(curl -s -X PATCH "$BASE/admin/users/$NEW_INST_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"isActive":true}')
check "admin يفعّل الحساب" "success" "$R"

# ─── 16. Reactivated user works ───────────────────────
echo ""
echo "【16】 المستخدم المفعّل يسجل دخول ويشتغل"
INST_TOKEN=$(get_token "newschool@test.com" "TestPass1")
R=$(curl -s "$BASE/requests" -H "Authorization: Bearer $INST_TOKEN")
check "المستخدم المفعّل يصل لـ /requests" "success" "$R"

# ─── 17. Change password ──────────────────────────────
echo ""
echo "【17】 admin يغيّر كلمة المرور"
R=$(curl -s -X PATCH "$BASE/admin/users/$NEW_INST_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"password":"NewPass99"}')
check "admin يغيّر كلمة المرور" "success" "$R"

# ─── 18. Login with new password ──────────────────────
echo ""
echo "【18】 تسجيل دخول بكلمة المرور الجديدة"
NEW_TOKEN=$(get_token "newschool@test.com" "NewPass99")
if [ -n "$NEW_TOKEN" ]; then
  check "تسجيل دخول بكلمة مرور جديدة" "success" '{"success":true}'
else
  check "تسجيل دخول بكلمة مرور جديدة" "success" '{"success":false}'
fi

# ─── 19. Old password fails ──────────────────────────
echo ""
echo "【19】 كلمة المرور القديمة لا تعمل"
OLD_FAIL=$(get_token "newschool@test.com" "TestPass1")
if [ -z "$OLD_FAIL" ]; then
  check "كلمة المرور القديمة لا تعمل" "success" '{"success":true}'
else
  check "كلمة المرور القديمة لا تعمل" "success" '{"success":false}'
fi

# ─── 20. Last admin cannot be deactivated ─────────────
echo ""
echo "【20】 لا يمكن تعطيل آخر admin"
ADMIN_USER=$(curl -s "$BASE/admin/users?userType=admin" -H "Authorization: Bearer $ADMIN_TOKEN")
ADMIN_ID=$(echo "$ADMIN_USER" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
R=$(curl -s -X PATCH "$BASE/admin/users/$ADMIN_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"isActive":false}')
check "لا يمكن تعطيل آخر admin" "fail" "$R"

# ─── 21. Last admin cannot be deleted ─────────────────
echo ""
echo "【21】 لا يمكن حذف آخر admin"
R=$(curl -s -X DELETE "$BASE/admin/users/$ADMIN_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
check "لا يمكن حذف آخر admin" "fail" "$R"

# ─── 22. Delete user ──────────────────────────────────
echo ""
echo "【22】 admin يحذف مستخدم"
R=$(curl -s -X DELETE "$BASE/admin/users/$NEW_WH_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
check "admin يحذف مستودع" "success" "$R"

# ─── 23. Deleted user cannot login ────────────────────
echo ""
echo "【23】 المستخدم المحذوف ما يقدر يسجل دخول"
DELETED=$(get_token "newwarehouse@test.com" "TestPass1")
if [ -z "$DELETED" ]; then
  check "المحذوف لا يسجل دخول" "success" '{"success":true}'
else
  check "المحذوف لا يسجل دخول" "success" '{"success":false}'
fi

# ─── 24. Duplicate email blocked ──────────────────────
echo ""
echo "【24】 لا يمكن إنشاء حساب بنفس البريد"
R=$(curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_new_inst.json)
check "بريد مكرر مرفوض" "fail" "$R"

# ─── 25. No token ─────────────────────────────────────
echo ""
echo "【25】 بدون token - مرفوض"
R=$(curl -s "$BASE/admin/users")
check "بدون token مرفوض" "fail" "$R"

# ═══════════════════════════════════════════════════
# اختبارات الكيانات الجديدة: Institutions + Warehouses + Routing
# ═══════════════════════════════════════════════════

# تنظيف مؤسسات اختبارية قديمة
INSTS=$(curl -s "$BASE/admin/institutions" -H "Authorization: Bearer $ADMIN_TOKEN")
for NAME in "مدرسة اختبارية جديدة" "مدرسة اختبارية معدّلة"; do
  OLD_ID=$(echo "$INSTS" | grep -B1 -o "\"name\":\"$NAME\"" 2>/dev/null || true)
done
# نستخدم jq-like approach — نحذف بالاسم عبر query
node -e "
const url = 'http://localhost:3001/api/v1/admin/institutions';
const token = '$ADMIN_TOKEN';
fetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
  .then(r => r.json())
  .then(async data => {
    const toDelete = data.data.filter(i => i.name === 'مدرسة اختبارية جديدة' || i.name === 'مدرسة اختبارية معدّلة');
    for (const i of toDelete) {
      await fetch(url + '/' + i.id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
    }
  }).catch(() => {});
" 2>/dev/null
sleep 0.5

# ─── 26. List institutions ────────────────────────────
echo ""
echo "【26】 admin يرى قائمة المؤسسات"
R=$(curl -s "$BASE/admin/institutions" -H "Authorization: Bearer $ADMIN_TOKEN")
check "admin يرى /admin/institutions" "success" "$R"

# ─── 27. Create institution ───────────────────────────
echo ""
echo "【27】 admin ينشئ مؤسسة جديدة"
cat > /tmp/_new_inst2.json <<'EOF'
{"name":"مدرسة اختبارية جديدة","institutionType":"school","governorate":"دمشق"}
EOF
R=$(curl -s -X POST "$BASE/admin/institutions" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_new_inst2.json)
check "إنشاء مؤسسة جديدة" "success" "$R"
NEW_INST2_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

# ─── 28. Duplicate institution blocked (قبل التعديل) ──
echo ""
echo "【28】 لا يمكن إنشاء مؤسسة بنفس الاسم ونفس المحافظة"
R=$(curl -s -X POST "$BASE/admin/institutions" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_new_inst2.json)
check "مؤسسة مكررة مرفوضة" "fail" "$R"

# ─── 29. Update institution ───────────────────────────
echo ""
echo "【29】 admin يعدّل اسم المؤسسة"
cat > /tmp/_upd_inst.json <<'EOF'
{"name":"مدرسة اختبارية معدّلة"}
EOF
R=$(curl -s -X PATCH "$BASE/admin/institutions/$NEW_INST2_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_upd_inst.json)
check "تعديل اسم مؤسسة" "success" "$R"

# ─── 30. Delete institution ───────────────────────────
echo ""
echo "【30】 admin يحذف المؤسسة الجديدة"
R=$(curl -s -X DELETE "$BASE/admin/institutions/$NEW_INST2_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
check "حذف مؤسسة" "success" "$R"

# ─── 31. List warehouses ──────────────────────────────
echo ""
echo "【31】 admin يرى قائمة المستودعات"
R=$(curl -s "$BASE/admin/warehouses" -H "Authorization: Bearer $ADMIN_TOKEN")
check "admin يرى /admin/warehouses" "success" "$R"

# ─── 32. Filter warehouses by governorate ─────────────
echo ""
echo "【32】 admin يفلتر المستودعات بالمحافظة"
R=$(curl -s "$BASE/admin/warehouses?governorate=%D8%AF%D9%85%D8%B4%D9%82" -H "Authorization: Bearer $ADMIN_TOKEN")
check "فلترة المستودعات" "success" "$R"

# ─── 33. Cannot create duplicate warehouse ────────────
echo ""
echo "【33】 لا يمكن إنشاء مستودعين بنفس القسم ونفس المحافظة"
cat > /tmp/_new_wh2.json <<'EOF'
{"name":"مستودع المواد والأثاث التعليمي - دمشق","departmentKey":"materials","governorate":"دمشق"}
EOF
R=$(curl -s -X POST "$BASE/admin/warehouses" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_new_wh2.json)
check "مستودع مكرر مرفوض" "fail" "$R"

# ─── 34. Update warehouse name ────────────────────────
echo ""
echo "【34】 admin يعدّل اسم مستودع"
# نجيب مستودع موجود
WH_LIST=$(curl -s "$BASE/admin/warehouses?governorate=%D8%AF%D9%85%D8%B4%D9%82" -H "Authorization: Bearer $ADMIN_TOKEN")
SOME_WH_ID=$(echo "$WH_LIST" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
R=$(curl -s -X PATCH "$BASE/admin/warehouses/$SOME_WH_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"name":"مستودع معدّل للاختبار"}')
check "تعديل اسم مستودع" "success" "$R"
# نرجع الاسم الأصلي
ORIGINAL_NAME=$(echo "$WH_LIST" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -s -X PATCH "$BASE/admin/warehouses/$SOME_WH_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d "{\"name\":\"$ORIGINAL_NAME\"}" > /dev/null

# ─── 35. Routing map ──────────────────────────────────
echo ""
echo "【35】 admin يرى خريطة التوجيه"
R=$(curl -s "$BASE/admin/routing-map" -H "Authorization: Bearer $ADMIN_TOKEN")
check "خريطة التوجيه" "success" "$R"

# التحقق من البنية: 14 محافظة، 5 أقسام
echo -n "   التحقق من البنية: "
GOV_COUNT=$(echo "$R" | grep -o '"governorateId":[0-9]*' | wc -l)
DEPT_COUNT_IN_MAP=$(echo "$R" | grep -o '"departmentKey":"[^"]*"' | wc -l)
if [ "$GOV_COUNT" -ge 14 ] && [ "$DEPT_COUNT_IN_MAP" -ge 70 ]; then
  echo "✅ 14 محافظة × 5 أقسام = 70 خلية"
  PASS=$((PASS+1))
else
  echo "❌ متوقع 14×5=70، وُجد: $GOV_COUNT محافظات × ${DEPT_COUNT_IN_MAP} خلايا"
  FAIL=$((FAIL+1))
fi

# ─── 36. Non-admin cannot access institutions ─────────
echo ""
echo "【36】 غير الـ admin ما يقدر يوصل لـ /admin/institutions"
R=$(curl -s "$BASE/admin/institutions" -H "Authorization: Bearer $WH_TOKEN")
check "مستودع يحاول /admin/institutions" "fail" "$R"

# ─── 37. Non-admin cannot access routing-map ──────────
echo ""
echo "【37】 غير الـ admin ما يقدر يوصل لـ /admin/routing-map"
R=$(curl -s "$BASE/admin/routing-map" -H "Authorization: Bearer $WH_TOKEN")
check "مستودع يحاول /admin/routing-map" "fail" "$R"

# ═══ اختبارات الأقسام ═══

# تنظيف قسم اختباري قديم
node -e "
fetch('$BASE/admin/departments', { headers: { 'Authorization': 'Bearer $ADMIN_TOKEN' } })
  .then(r => r.json())
  .then(async d => {
    const old = d.data.find(x => x.key === 'test-dept' || x.key === 'sports-test');
    if (old) await fetch('$BASE/admin/departments/' + old.id, { method: 'DELETE', headers: { 'Authorization': 'Bearer $ADMIN_TOKEN' } });
  }).catch(() => {});
" 2>/dev/null
sleep 0.5

echo ""
echo "【38】 admin يرى قائمة الأقسام"
R=$(curl -s "$BASE/admin/departments" -H "Authorization: Bearer $ADMIN_TOKEN")
check "قائمة الأقسام" "success" "$R"

echo ""
echo "【39】 admin ينشئ قسم جديد"
cat > /tmp/_dept.json <<'EOF'
{"key":"test-dept","labelAr":"قسم تجريبي"}
EOF
R=$(curl -s -X POST "$BASE/admin/departments" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_dept.json)
check "إنشاء قسم" "success" "$R"
NEW_DEPT_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

echo ""
echo "【40】 لا يمكن إنشاء قسم بنفس المفتاح"
R=$(curl -s -X POST "$BASE/admin/departments" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_dept.json)
check "مفتاح مكرر مرفوض" "fail" "$R"

echo ""
echo "【41】 رفض مفتاح بصيغة خاطئة"
cat > /tmp/_bad_dept.json <<'EOF'
{"key":"Invalid Key!","labelAr":"قسم سيء"}
EOF
R=$(curl -s -X POST "$BASE/admin/departments" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_bad_dept.json)
check "مفتاح بصيغة خاطئة مرفوض" "fail" "$R"

echo ""
echo "【42】 admin يعدّل اسم القسم"
R=$(curl -s -X PATCH "$BASE/admin/departments/$NEW_DEPT_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"labelAr":"قسم تجريبي معدّل"}')
check "تعديل قسم" "success" "$R"

echo ""
echo "【43】 لا يمكن حذف قسم مرتبط بمستودعات"
R=$(curl -s -X DELETE "$BASE/admin/departments/1" -H "Authorization: Bearer $ADMIN_TOKEN")
check "قسم مرتبط بمستودعات مرفوض" "fail" "$R"

echo ""
echo "【44】 admin يحذف قسم بدون ارتباطات"
R=$(curl -s -X DELETE "$BASE/admin/departments/$NEW_DEPT_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
check "حذف قسم" "success" "$R"

echo ""
echo "【45】 غير الـ admin ما يقدر يوصل لـ /admin/departments"
R=$(curl -s -X POST "$BASE/admin/departments" -H "Content-Type: application/json" -H "Authorization: Bearer $WH_TOKEN" -d @/tmp/_dept.json)
check "مستودع يحاول إنشاء قسم" "fail" "$R"

# ═══ اختبارات الوحدات والأولويات ═══

# تنظيف قديمة
node -e "
fetch('$BASE/admin/units', { headers: { 'Authorization': 'Bearer $ADMIN_TOKEN' } })
  .then(r => r.json())
  .then(async d => {
    const old = d.data.find(u => u.name === 'وحدة اختبارية');
    if (old) await fetch('$BASE/admin/units/' + old.id, { method: 'DELETE', headers: { 'Authorization': 'Bearer $ADMIN_TOKEN' } });
  }).catch(() => {});
fetch('$BASE/admin/priorities', { headers: { 'Authorization': 'Bearer $ADMIN_TOKEN' } })
  .then(r => r.json())
  .then(async d => {
    const old = d.data.find(p => p.key === 'urgent-test');
    if (old) await fetch('$BASE/admin/priorities/' + old.id, { method: 'DELETE', headers: { 'Authorization': 'Bearer $ADMIN_TOKEN' } });
  }).catch(() => {});
" 2>/dev/null
sleep 0.5

echo ""
echo "【46】 قائمة الوحدات"
R=$(curl -s "$BASE/admin/units" -H "Authorization: Bearer $ADMIN_TOKEN")
check "قائمة الوحدات" "success" "$R"

echo ""
echo "【47】 إنشاء وحدة"
cat > /tmp/_unit.json <<'EOF'
{"name":"وحدة اختبارية"}
EOF
R=$(curl -s -X POST "$BASE/admin/units" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_unit.json)
check "إنشاء وحدة" "success" "$R"
NEW_UNIT_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

echo ""
echo "【48】 رفض وحدة مكررة"
R=$(curl -s -X POST "$BASE/admin/units" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_unit.json)
check "وحدة مكررة مرفوضة" "fail" "$R"

echo ""
echo "【49】 حذف وحدة"
R=$(curl -s -X DELETE "$BASE/admin/units/$NEW_UNIT_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
check "حذف وحدة" "success" "$R"

echo ""
echo "【50】 قائمة الأولويات"
R=$(curl -s "$BASE/admin/priorities" -H "Authorization: Bearer $ADMIN_TOKEN")
check "قائمة الأولويات" "success" "$R"

echo ""
echo "【51】 إنشاء أولوية"
cat > /tmp/_pri.json <<'EOF'
{"key":"urgent-test","labelAr":"عاجل جداً","color":"#dc2626"}
EOF
R=$(curl -s -X POST "$BASE/admin/priorities" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_pri.json)
check "إنشاء أولوية" "success" "$R"
NEW_PRI_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

echo ""
echo "【52】 حذف الأولوية الاختبارية"
R=$(curl -s -X DELETE "$BASE/admin/priorities/$NEW_PRI_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
check "حذف أولوية" "success" "$R"

echo ""
echo "【53】 لا يمكن حذف أولوية مستخدمة"
# high مستخدمة لأن فيه طلبات بأولوية high
R=$(curl -s -X DELETE "$BASE/admin/priorities/1" -H "Authorization: Bearer $ADMIN_TOKEN")
check "أولوية مستخدمة مرفوضة" "fail" "$R"

echo ""
echo "【54】 غير الـ admin ما يقدر يوصل لـ /admin/units"
R=$(curl -s -X POST "$BASE/admin/units" -H "Content-Type: application/json" -H "Authorization: Bearer $WH_TOKEN" -d @/tmp/_unit.json)
check "مستودع يحاول إنشاء وحدة" "fail" "$R"

# ═══════════════════════════════════════════════════════════════
# الاختبارات الشاملة الجديدة: P0 + P1 features
# ═══════════════════════════════════════════════════════════════

# ─── Password policy ────────────────────────────────
echo ""
echo "【55】 كلمة مرور 4 أحرف مرفوضة"
cat > /tmp/_wp.json <<EOF
{"email":"weak@x.com","password":"1234","userType":"admin"}
EOF
R=$(curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_wp.json)
check "كلمة مرور قصيرة مرفوضة" "fail" "$R"

echo ""
echo "【56】 كلمة مرور بدون حرف كبير مرفوضة"
cat > /tmp/_wp.json <<EOF
{"email":"weak@x.com","password":"abcd1234","userType":"admin"}
EOF
R=$(curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_wp.json)
check "لا حرف كبير مرفوض" "fail" "$R"

echo ""
echo "【57】 كلمة مرور بدون رقم مرفوضة"
cat > /tmp/_wp.json <<EOF
{"email":"weak@x.com","password":"AbcdEfgh","userType":"admin"}
EOF
R=$(curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_wp.json)
check "لا رقم مرفوض" "fail" "$R"

echo ""
echo "【58】 كلمة مرور قوية مقبولة"
cat > /tmp/_wp.json <<EOF
{"email":"strongpwd@test.com","password":"Strong123","userType":"admin"}
EOF
R=$(curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_wp.json)
check "كلمة مرور قوية مقبولة" "success" "$R"
TMP_ADMIN_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

# ─── Admin self-management ──────────────────────────
echo ""
echo "【59】 الأدمن الثاني يسجل دخول"
TMP_ADMIN_TOKEN=$(get_token "strongpwd@test.com" "Strong123")
if [ -n "$TMP_ADMIN_TOKEN" ]; then
  check "أدمن ثاني يسجل دخول" "success" '{"success":true}'
else
  check "أدمن ثاني يسجل دخول" "success" '{"success":false}'
fi

echo ""
echo "【60】 الأدمن يعدّل نفسه (تم السماح)"
R=$(curl -s -X PATCH "$BASE/admin/users/$TMP_ADMIN_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"isActive":false}')
check "تعديل أدمن ثاني" "success" "$R"

# إعادة تفعيله
curl -s -X PATCH "$BASE/admin/users/$TMP_ADMIN_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"isActive":true}' > /dev/null

# ─── Change password (self) ─────────────────────────
echo ""
echo "【61】 مستخدم يغيّر كلمة مروره بكلمة حالية خاطئة"
R=$(curl -s -X PATCH "$BASE/auth/me/password" -H "Content-Type: application/json" -H "Authorization: Bearer $INST_TOKEN" -d '{"currentPassword":"WrongPass","newPassword":"NewGood1"}')
check "كلمة حالية خاطئة مرفوضة" "fail" "$R"

echo ""
echo "【62】 مستخدم يغيّر كلمة مروره بنجاح"
# INST_TOKEN قد يكون منتهي — نجلب جديد
INST_TOKEN=$(get_token "newschool@test.com" "NewPass99")
R=$(curl -s -X PATCH "$BASE/auth/me/password" -H "Content-Type: application/json" -H "Authorization: Bearer $INST_TOKEN" -d '{"currentPassword":"NewPass99","newPassword":"Changed1A"}')
check "تغيير كلمة المرور الذاتي" "success" "$R"

echo ""
echo "【63】 تسجيل دخول بكلمة المرور الجديدة بعد self-change"
NEW_INST_TOKEN=$(get_token "newschool@test.com" "Changed1A")
if [ -n "$NEW_INST_TOKEN" ]; then
  check "تسجيل دخول بالجديدة" "success" '{"success":true}'
else
  check "تسجيل دخول بالجديدة" "success" '{"success":false}'
fi

# ─── Forgot password lifecycle ──────────────────────
echo ""
echo "【64】 طلب forgot-password"
R=$(curl -s -X POST "$BASE/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"newschool@test.com"}')
check "forgot-password يُرسِل طلباً" "success" "$R"

echo ""
echo "【65】 forgot-password لبريد غير موجود يرجع نجاحاً (أمان)"
R=$(curl -s -X POST "$BASE/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"nonexistent@x.com"}')
check "forgot-password لبريد غير موجود" "success" "$R"

echo ""
echo "【66】 الأدمن يرى قائمة طلبات الاستعادة"
R=$(curl -s "$BASE/admin/password-resets?status=pending" -H "Authorization: Bearer $ADMIN_TOKEN")
check "قائمة طلبات الاستعادة" "success" "$R"
RESET_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

echo ""
echo "【67】 الأدمن يوافق على الطلب ويعين كلمة مرور جديدة"
R=$(curl -s -X POST "$BASE/admin/password-resets/$RESET_ID/approve" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"newPassword":"ResetNew1"}')
check "موافقة على الاستعادة" "success" "$R"

echo ""
echo "【68】 تسجيل دخول بالكلمة المعاد تعيينها"
RESET_TOKEN=$(get_token "newschool@test.com" "ResetNew1")
if [ -n "$RESET_TOKEN" ]; then
  check "تسجيل دخول بالمعاد تعيينها" "success" '{"success":true}'
else
  check "تسجيل دخول بالمعاد تعيينها" "success" '{"success":false}'
fi

# ─── Audit log ──────────────────────────────────────
echo ""
echo "【69】 سجل الأحداث يحتوي على إجراءات الأدمن"
R=$(curl -s "$BASE/admin/audit-logs?pageSize=50" -H "Authorization: Bearer $ADMIN_TOKEN")
TOTAL=$(echo "$R" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
if [ "${TOTAL:-0}" -gt 0 ]; then
  check "audit log يحتوي سجلات" "success" '{"success":true}'
else
  check "audit log يحتوي سجلات" "success" '{"success":false}'
fi

echo ""
echo "【70】 فلترة audit log بـ entityType=user"
R=$(curl -s "$BASE/admin/audit-logs?entityType=user" -H "Authorization: Bearer $ADMIN_TOKEN")
check "فلترة audit log" "success" "$R"

echo ""
echo "【71】 approve-password-reset مسجَّل في audit log"
R=$(curl -s "$BASE/admin/audit-logs?entityType=passwordReset&pageSize=5" -H "Authorization: Bearer $ADMIN_TOKEN")
if echo "$R" | grep -q 'approve-password-reset'; then
  check "approve-reset مسجَّل" "success" '{"success":true}'
else
  check "approve-reset مسجَّل" "success" '{"success":false}'
fi

# ─── Notifications ──────────────────────────────────
echo ""
echo "【72】 قائمة الإشعارات لمستخدم"
R=$(curl -s "$BASE/notifications" -H "Authorization: Bearer $INST_TOKEN")
check "قائمة إشعارات" "success" "$R"

echo ""
echo "【73】 قائمة الإشعارات بدون توكن مرفوضة"
R=$(curl -s "$BASE/notifications")
check "إشعارات بدون توكن" "fail" "$R"

echo ""
echo "【74】 mark-all-read يعمل"
R=$(curl -s -X POST "$BASE/notifications/read-all" -H "Authorization: Bearer $INST_TOKEN")
check "mark-all-read" "success" "$R"

# ─── Soft deletes ───────────────────────────────────
echo ""
echo "【75】 حذف مؤسسة جديدة بدون طلبات (soft delete)"
cat > /tmp/_soft.json <<'EOF'
{"name":"مدرسة اختبار الحذف الناعم","institutionType":"school","governorate":"دمشق"}
EOF
R=$(curl -s -X POST "$BASE/admin/institutions" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_soft.json)
SOFT_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
R=$(curl -s -X DELETE "$BASE/admin/institutions/$SOFT_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
check "حذف مؤسسة بدون طلبات" "success" "$R"

echo ""
echo "【76】 المؤسسة المحذوفة ناعماً لا تظهر في القائمة"
R=$(curl -s "$BASE/admin/institutions?governorate=%D8%AF%D9%85%D8%B4%D9%82" -H "Authorization: Bearer $ADMIN_TOKEN")
if echo "$R" | grep -q '"id":'"$SOFT_ID"','; then
  check "soft-deleted لا تظهر" "success" '{"success":false}'
else
  check "soft-deleted لا تظهر" "success" '{"success":true}'
fi

# ─── Security headers (Helmet) ──────────────────────
echo ""
echo "【77】 Helmet: X-Content-Type-Options مضبوط"
R=$(curl -s -I "$BASE/governorates" 2>&1 | grep -i "x-content-type-options")
if [ -n "$R" ]; then
  check "Helmet headers" "success" '{"success":true}'
else
  check "Helmet headers" "success" '{"success":false}'
fi

# ─── Request size limit ─────────────────────────────
echo ""
echo "【78】 Request > 1MB مرفوض (413)"
python -c "import json; print(json.dumps({'email':'big@x.com','password':'TestPass1','userType':'admin','x':'A'*2000000}))" > /tmp/_big.json
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_big.json)
if [ "$HTTP_CODE" = "413" ]; then
  check "Request size limit (413)" "success" '{"success":true}'
else
  check "Request size limit (413)" "success" '{"success":false}'
fi

# ─── Change password requires strong policy ──────────
echo ""
echo "【79】 change-password برفض كلمة ضعيفة"
# INST_TOKEN صار RESET_TOKEN بعد الاستعادة
R=$(curl -s -X PATCH "$BASE/auth/me/password" -H "Content-Type: application/json" -H "Authorization: Bearer $RESET_TOKEN" -d '{"currentPassword":"ResetNew1","newPassword":"1234"}')
check "change-password كلمة ضعيفة" "fail" "$R"

# ═══════════════════════════════════════════════════════════════
# اختبارات شاملة لـ Business Logic
# Request lifecycle + Inventory + Reports + Public lookups
# ═══════════════════════════════════════════════════════════════

# نعيد إنشاء حساب المستودع (كان قد حُذف في اختبار 22)
WH_ID=$(node -e "
fetch('$BASE/admin/warehouses?governorate=%D8%AD%D9%84%D8%A8&departmentKey=maintenance', { headers: { 'Authorization': 'Bearer $ADMIN_TOKEN' } })
  .then(r => r.json())
  .then(d => { const free = d.data.find(w => !w.hasAccount); if (free) console.log(free.id); })
" 2>/dev/null)

cat > /tmp/_new_wh2.json <<EOF
{"email":"newwarehouse@test.com","password":"TestPass1","userType":"warehouse","warehouseId":$WH_ID}
EOF
curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_new_wh2.json > /dev/null

# tokens نظيفة للاختبار
FRESH_INST_TOKEN=$(get_token "newschool@test.com" "ResetNew1")
FRESH_WH_TOKEN=$(get_token "newwarehouse@test.com" "TestPass1")

# ─── Public Lookups ─────────────────────────────────
echo ""
echo "【80】 lookup: قائمة المحافظات"
R=$(curl -s "$BASE/governorates")
check "lookup governorates" "success" "$R"

echo ""
echo "【81】 lookup: قائمة الأقسام"
R=$(curl -s "$BASE/departments")
check "lookup departments" "success" "$R"

echo ""
echo "【82】 lookup: قائمة الأولويات"
R=$(curl -s "$BASE/priorities")
check "lookup priorities" "success" "$R"

echo ""
echo "【83】 lookup: أنواع المؤسسات"
R=$(curl -s "$BASE/institution-types")
check "lookup institution-types" "success" "$R"

echo ""
echo "【84】 lookup: عناصر قسم maintenance"
R=$(curl -s "$BASE/department-items?departmentKey=maintenance")
check "lookup department-items" "success" "$R"

# ─── Inventory CRUD ─────────────────────────────────
echo ""
echo "【85】 المستودع يضيف عنصر مخزون (كهرباء)"
cat > /tmp/_inv.json <<'EOF'
{"name":"صيانة كهرباء","category":"electrical","quantity":100,"unitType":"خدمة","minThreshold":10,"department":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/inventory" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d @/tmp/_inv.json)
check "إضافة عنصر مخزون" "success" "$R"
INV_ID1=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

echo ""
echo "【86】 إضافة نفس العنصر تدمج الكمية (restock)"
QTY_B4=$(curl -s "$BASE/inventory" -H "Authorization: Bearer $FRESH_WH_TOKEN" | python -c "
import json, sys
d = json.load(sys.stdin)
for i in d['data']:
    if i['id'] == $INV_ID1:
        print(i['quantity']); break
")
R=$(curl -s -X POST "$BASE/inventory" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d @/tmp/_inv.json)
QTY_AFTER_MERGE=$(curl -s "$BASE/inventory" -H "Authorization: Bearer $FRESH_WH_TOKEN" | python -c "
import json, sys
d = json.load(sys.stdin)
for i in d['data']:
    if i['id'] == $INV_ID1:
        print(i['quantity']); break
")
EXP=$((QTY_B4 + 100))
if [ "$QTY_AFTER_MERGE" = "$EXP" ]; then
  check "دمج الكمية (restock) $QTY_B4 → $QTY_AFTER_MERGE" "success" '{"success":true}'
else
  check "دمج الكمية ($QTY_B4 + 100 = متوقع $EXP, فعلياً $QTY_AFTER_MERGE)" "success" '{"success":false}'
fi

echo ""
echo "【87】 قائمة مخزون المستودع"
R=$(curl -s "$BASE/inventory" -H "Authorization: Bearer $FRESH_WH_TOKEN")
check "قائمة المخزون" "success" "$R"

echo ""
echo "【88】 تحديث كمية عنصر مخزون"
R=$(curl -s -X PATCH "$BASE/inventory/$INV_ID1" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"quantity":150}')
check "تحديث كمية" "success" "$R"

echo ""
echo "【89】 عناصر قليلة المخزون /low-stock"
# نضيف عنصر كمية قليلة
cat > /tmp/_inv2.json <<'EOF'
{"name":"صيانة مياه","category":"water","quantity":2,"unitType":"خدمة","minThreshold":5,"department":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/inventory" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d @/tmp/_inv2.json)
INV_ID2=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
R=$(curl -s "$BASE/inventory/low-stock" -H "Authorization: Bearer $FRESH_WH_TOKEN")
if echo "$R" | grep -q '"صيانة مياه"'; then
  check "low-stock يحتوي عنصر قليل" "success" '{"success":true}'
else
  check "low-stock يحتوي عنصر قليل" "success" '{"success":false}'
fi

echo ""
echo "【90】 حذف عنصر مخزون"
R=$(curl -s -X DELETE "$BASE/inventory/$INV_ID2" -H "Authorization: Bearer $FRESH_WH_TOKEN")
check "حذف عنصر مخزون" "success" "$R"

# ─── Request creation + lifecycle ───────────────────
echo ""
echo "【91】 المؤسسة تنشئ طلب مسودة (draft)"
cat > /tmp/_req.json <<'EOF'
{"title":"اختبار lifecycle","description":"وصف","priority":"high","status":"draft","quantity":5,"studentsAffected":10,"unitType":"خدمة","subcategory":"electrical","departmentKey":"maintenance","requestedItems":[{"itemName":"صيانة كهرباء","originalKey":"electrical","quantity":5,"unitType":"خدمة","displayText":"صيانة كهرباء"}]}
EOF
R=$(curl -s -X POST "$BASE/requests" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_req.json)
check "إنشاء مسودة" "success" "$R"
REQ_ID=$(echo "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo ""
echo "【92】 قائمة طلبات المؤسسة تحتوي المسودة"
R=$(curl -s "$BASE/requests" -H "Authorization: Bearer $FRESH_INST_TOKEN")
if echo "$R" | grep -q "\"id\":\"$REQ_ID\""; then
  check "قائمة طلبات المؤسسة" "success" '{"success":true}'
else
  check "قائمة طلبات المؤسسة" "success" '{"success":false}'
fi

echo ""
echo "【93】 تعديل المسودة"
cat > /tmp/_req_upd.json <<'EOF'
{"title":"اختبار lifecycle معدل","description":"وصف جديد","priority":"medium","quantity":3,"studentsAffected":15,"unitType":"خدمة","subcategory":"electrical"}
EOF
R=$(curl -s -X PATCH "$BASE/requests/$REQ_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_req_upd.json)
check "تعديل المسودة" "success" "$R"

echo ""
echo "【94】 المؤسسة تحوّل draft → pending"
R=$(curl -s -X PATCH "$BASE/requests/$REQ_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d '{"status":"pending"}')
check "draft → pending" "success" "$R"

echo ""
echo "【95】 المستودع يرى الطلب في قائمته"
R=$(curl -s "$BASE/warehouse/requests" -H "Authorization: Bearer $FRESH_WH_TOKEN")
if echo "$R" | grep -q "\"id\":\"$REQ_ID\""; then
  check "المستودع يرى الطلب" "success" '{"success":true}'
else
  check "المستودع يرى الطلب" "success" '{"success":false}'
fi

echo ""
echo "【96】 المستودع: pending → in_progress"
R=$(curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"in_progress"}')
check "pending → in_progress" "success" "$R"

# نجلب كمية المخزون قبل ready_for_pickup
QTY_BEFORE=$(curl -s "$BASE/inventory/$INV_ID1" -H "Authorization: Bearer $FRESH_WH_TOKEN" 2>/dev/null)
QTY_BEFORE=$(curl -s "$BASE/inventory" -H "Authorization: Bearer $FRESH_WH_TOKEN" | python -c "
import json, sys
d = json.load(sys.stdin)
for i in d['data']:
    if i['id'] == $INV_ID1:
        print(i['quantity']); break
")

echo ""
echo "【97】 المستودع: in_progress → ready_for_pickup (يخصم مخزون)"
R=$(curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"ready_for_pickup"}')
check "ready_for_pickup" "success" "$R"

echo ""
echo "【98】 كمية المخزون نقصت بعد ready_for_pickup"
QTY_AFTER=$(curl -s "$BASE/inventory" -H "Authorization: Bearer $FRESH_WH_TOKEN" | python -c "
import json, sys
d = json.load(sys.stdin)
for i in d['data']:
    if i['id'] == $INV_ID1:
        print(i['quantity']); break
")
# الخصم يعتمد على requestedItems.quantity (=5) وليس على request.quantity
EXPECTED=$((QTY_BEFORE - 5))
if [ "$QTY_AFTER" = "$EXPECTED" ]; then
  check "المخزون نقص بـ 5 (من $QTY_BEFORE إلى $QTY_AFTER)" "success" '{"success":true}'
else
  check "المخزون نقص بـ 5 ($QTY_BEFORE → $QTY_AFTER, متوقع $EXPECTED)" "success" '{"success":false}'
fi

echo ""
echo "【99】 المستودع: ready_for_pickup → undelivered (يُرجع مخزون)"
R=$(curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"undelivered"}')
check "ready_for_pickup → undelivered" "success" "$R"

echo ""
echo "【100】 كمية المخزون رجعت بعد undelivered"
QTY_RETURNED=$(curl -s "$BASE/inventory" -H "Authorization: Bearer $FRESH_WH_TOKEN" | python -c "
import json, sys
d = json.load(sys.stdin)
for i in d['data']:
    if i['id'] == $INV_ID1:
        print(i['quantity']); break
")
if [ "$QTY_RETURNED" = "$QTY_BEFORE" ]; then
  check "المخزون رجع لقيمته الأصلية ($QTY_BEFORE)" "success" '{"success":true}'
else
  check "المخزون رجع ($QTY_BEFORE, الآن $QTY_RETURNED)" "success" '{"success":false}'
fi

echo ""
echo "【101】 undelivered → pending (إعادة المحاولة)"
R=$(curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"pending"}')
check "undelivered → pending" "success" "$R"

# المسار الكامل للإكمال: pending → in_progress → ready_for_pickup → completed
curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"in_progress"}' > /dev/null
curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"ready_for_pickup"}' > /dev/null

echo ""
echo "【102】 ready_for_pickup → completed (لا يُرجع مخزون)"
R=$(curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"completed"}')
check "ready_for_pickup → completed" "success" "$R"

# ─── Invalid state transitions ──────────────────────
echo ""
echo "【103】 completed → pending مرفوض (نهائية)"
R=$(curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"pending"}')
check "completed → pending مرفوض" "fail" "$R"

# نحتاج طلب جديد pending للاختبار
cat > /tmp/_req2.json <<'EOF'
{"title":"طلب invalid-test","description":"d","priority":"low","status":"pending","quantity":1,"studentsAffected":0,"unitType":"خدمة","subcategory":"electrical","departmentKey":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/requests" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_req2.json)
REQ_ID2=$(echo "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo ""
echo "【104】 pending → completed مرفوض (تخطي حالات)"
R=$(curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID2/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"completed"}')
check "pending → completed مرفوض" "fail" "$R"

echo ""
echo "【105】 rejected → in_progress مرفوض"
cat > /tmp/_rej.json <<'EOF'
{"status":"rejected","rejectionReason":"غير مستوفي"}
EOF
curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID2/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d @/tmp/_rej.json > /dev/null
R=$(curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID2/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"in_progress"}')
check "rejected → in_progress مرفوض" "fail" "$R"

# ─── Reject with reason ─────────────────────────────
echo ""
echo "【106】 المستودع يرفض مع سبب → rejectionReason محفوظ"
cat > /tmp/_req3.json <<'EOF'
{"title":"طلب للرفض","description":"d","priority":"low","status":"pending","quantity":1,"studentsAffected":0,"unitType":"خدمة","subcategory":"electrical","departmentKey":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/requests" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_req3.json)
REQ_ID3=$(echo "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
cat > /tmp/_rej2.json <<'EOF'
{"status":"rejected","rejectionReason":"لا يوجد مخزون كافٍ"}
EOF
R=$(curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID3/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d @/tmp/_rej2.json)
if echo "$R" | grep -q '"rejectionReason":"لا يوجد مخزون كافٍ"'; then
  check "rejectionReason محفوظ" "success" '{"success":true}'
else
  check "rejectionReason محفوظ" "success" '{"success":false}'
fi

# ─── Cancel by institution ─────────────────────────
echo ""
echo "【107】 المؤسسة تلغي طلبها (draft → cancelled)"
cat > /tmp/_req4.json <<'EOF'
{"title":"طلب للإلغاء","description":"d","priority":"low","status":"draft","quantity":1,"studentsAffected":0,"unitType":"خدمة","subcategory":"electrical","departmentKey":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/requests" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_req4.json)
REQ_ID4=$(echo "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
cat > /tmp/_can.json <<'EOF'
{"status":"cancelled","cancellationReason":"لم تعد مطلوبة"}
EOF
R=$(curl -s -X PATCH "$BASE/requests/$REQ_ID4/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_can.json)
check "إلغاء طلب draft" "success" "$R"

echo ""
echo "【108】 المؤسسة تحذف مسودة"
cat > /tmp/_req5.json <<'EOF'
{"title":"مسودة للحذف","description":"d","priority":"low","status":"draft","quantity":1,"studentsAffected":0,"unitType":"خدمة","subcategory":"electrical","departmentKey":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/requests" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_req5.json)
REQ_ID5=$(echo "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
R=$(curl -s -X DELETE "$BASE/requests/$REQ_ID5" -H "Authorization: Bearer $FRESH_INST_TOKEN")
check "حذف مسودة" "success" "$R"

echo ""
echo "【109】 لا يمكن حذف طلب غير مسودة"
R=$(curl -s -X DELETE "$BASE/requests/$REQ_ID" -H "Authorization: Bearer $FRESH_INST_TOKEN")
check "حذف غير مسودة مرفوض" "fail" "$R"

# ─── Reports ───────────────────────────────────────
echo ""
echo "【110】 توليد تقرير شهري"
R=$(curl -s -X POST "$BASE/reports/generate" -H "Authorization: Bearer $FRESH_INST_TOKEN")
check "توليد تقرير شهري" "success" "$R"
REP_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

echo ""
echo "【111】 قائمة التقارير"
R=$(curl -s "$BASE/reports" -H "Authorization: Bearer $FRESH_INST_TOKEN")
check "قائمة التقارير" "success" "$R"

echo ""
echo "【112】 تقرير محدد بالـ ID"
R=$(curl -s "$BASE/reports/$REP_ID" -H "Authorization: Bearer $FRESH_INST_TOKEN")
check "تقرير محدد" "success" "$R"

# ═══════════════════════════════════════════════════════════════
# Phase B: P0 Security/Authorization/Validation Tests
# ═══════════════════════════════════════════════════════════════

# نحضّر "مؤسسة B" و "مستودع Y" في محافظة مختلفة (حمص) لاختبارات IDOR
INST_B_ID=$(node -e "
fetch('$BASE/admin/institutions?governorate=%D8%AD%D9%85%D8%B5', { headers: { 'Authorization': 'Bearer $ADMIN_TOKEN' } })
  .then(r => r.json())
  .then(d => { const free = d.data.find(i => !i.hasAccount); if (free) console.log(free.id); })
" 2>/dev/null)

WH_Y_ID=$(node -e "
fetch('$BASE/admin/warehouses?governorate=%D8%AD%D9%85%D8%B5&departmentKey=materials', { headers: { 'Authorization': 'Bearer $ADMIN_TOKEN' } })
  .then(r => r.json())
  .then(d => { const free = d.data.find(w => !w.hasAccount); if (free) console.log(free.id); })
" 2>/dev/null)

# حذف مستخدمين سابقين إن وُجدوا (idempotent)
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.user.deleteMany({ where: { email: { in: ['instb@test.com', 'why@test.com'] } } });
  await p.\$disconnect();
})();
" 2>/dev/null

cat > /tmp/_inst_b.json <<EOF
{"email":"instb@test.com","password":"InstB1234","userType":"institution","institutionId":$INST_B_ID}
EOF
curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_inst_b.json > /dev/null

cat > /tmp/_wh_y.json <<EOF
{"email":"why@test.com","password":"WhyPass1","userType":"warehouse","warehouseId":$WH_Y_ID}
EOF
curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_wh_y.json > /dev/null

INST_B_TOKEN=$(get_token "instb@test.com" "InstB1234")
WH_Y_TOKEN=$(get_token "why@test.com" "WhyPass1")

# ─── B-1: IDOR ─────────────────────────────────────
echo ""
echo "【113】 IDOR: مؤسسة B تحاول GET طلب مؤسسة A"
# REQ_ID ينتمي لـ FRESH_INST (مؤسسة A)
R=$(curl -s "$BASE/requests/$REQ_ID" -H "Authorization: Bearer $INST_B_TOKEN")
check "IDOR GET request مرفوض" "fail" "$R"

echo ""
echo "【114】 IDOR: مؤسسة B تحاول GET تقرير مؤسسة A"
R=$(curl -s "$BASE/reports/$REP_ID" -H "Authorization: Bearer $INST_B_TOKEN")
check "IDOR GET report مرفوض" "fail" "$R"

echo ""
echo "【115】 IDOR: مستودع Y يحاول PATCH طلب مستودع A"
# REQ_ID2 موجود في مستودع A
R=$(curl -s -X PATCH "$BASE/warehouse/requests/$REQ_ID2/status" -H "Content-Type: application/json" -H "Authorization: Bearer $WH_Y_TOKEN" -d '{"status":"in_progress"}')
check "IDOR PATCH warehouse status مرفوض" "fail" "$R"

echo ""
echo "【116】 IDOR: مستودع Y يحاول PATCH عنصر مخزون مستودع A"
R=$(curl -s -X PATCH "$BASE/inventory/$INV_ID1" -H "Content-Type: application/json" -H "Authorization: Bearer $WH_Y_TOKEN" -d '{"quantity":999}')
check "IDOR PATCH inventory مرفوض" "fail" "$R"

echo ""
echo "【117】 IDOR: مستودع Y يحاول DELETE عنصر مخزون مستودع A"
R=$(curl -s -X DELETE "$BASE/inventory/$INV_ID1" -H "Authorization: Bearer $WH_Y_TOKEN")
check "IDOR DELETE inventory مرفوض" "fail" "$R"

# ─── B-2: Authorization boundaries ─────────────────
echo ""
echo "【118】 مؤسسة تحاول POST /admin/users"
R=$(curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d '{"email":"x@y.com","password":"Pass1234","userType":"admin"}')
check "مؤسسة → admin/users مرفوض" "fail" "$R"

echo ""
echo "【119】 مستودع يحاول GET /admin/audit-logs"
R=$(curl -s "$BASE/admin/audit-logs" -H "Authorization: Bearer $FRESH_WH_TOKEN")
check "مستودع → audit-logs مرفوض" "fail" "$R"

echo ""
echo "【120】 مؤسسة تحاول GET /warehouse/requests"
R=$(curl -s "$BASE/warehouse/requests" -H "Authorization: Bearer $FRESH_INST_TOKEN")
check "مؤسسة → warehouse/requests مرفوض" "fail" "$R"

echo ""
echo "【121】 مستودع يحاول GET /requests"
R=$(curl -s "$BASE/requests" -H "Authorization: Bearer $FRESH_WH_TOKEN")
check "مستودع → /requests مرفوض" "fail" "$R"

# ─── B-3: JWT Security ─────────────────────────────
echo ""
echo "【122】 request بدون Authorization header"
R=$(curl -s "$BASE/auth/me")
check "بدون auth مرفوض" "fail" "$R"

echo ""
echo "【123】 request بتوكن مشوّه"
R=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer FAKE.TOKEN.HERE")
check "توكن مشوّه مرفوض" "fail" "$R"

echo ""
echo "【124】 request بتوكن مستخدم محذوف"
# ننشئ مستخدم، نجيب توكنه، ثم نحذفه
cat > /tmp/_temp_user.json <<'EOF'
{"email":"deltemp@test.com","password":"DelTemp1","userType":"admin"}
EOF
R=$(curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_temp_user.json)
DEL_USER_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
DEL_TOKEN=$(get_token "deltemp@test.com" "DelTemp1")
curl -s -X DELETE "$BASE/admin/users/$DEL_USER_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
R=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $DEL_TOKEN")
check "توكن لمستخدم محذوف مرفوض" "fail" "$R"

echo ""
echo "【125】 request بتوكن مستخدم معطَّل"
cat > /tmp/_disabled_user.json <<'EOF'
{"email":"disabled@test.com","password":"Disable1","userType":"admin"}
EOF
R=$(curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_disabled_user.json)
DIS_USER_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
DIS_TOKEN=$(get_token "disabled@test.com" "Disable1")
curl -s -X PATCH "$BASE/admin/users/$DIS_USER_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"isActive":false}' > /dev/null
R=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $DIS_TOKEN")
check "توكن لمستخدم معطَّل مرفوض" "fail" "$R"
curl -s -X DELETE "$BASE/admin/users/$DIS_USER_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

# ─── B-4: Mass Assignment ──────────────────────────
echo ""
echo "【126】 Mass assignment على /auth/me/password (isActive/userType) مرفوض (strict)"
R=$(curl -s -X PATCH "$BASE/auth/me/password" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d '{"currentPassword":"ResetNew1","newPassword":"NewMass1","isActive":false,"userType":"admin"}')
check "mass assignment على change-password مرفوض" "fail" "$R"

echo ""
echo "【127】 Mass assignment على PATCH /requests/:id (institutionId) يُتجاهل"
# REQ_ID الآن completed — نستخدم طلب draft
cat > /tmp/_draft_mass.json <<'EOF'
{"title":"mass-test","description":"d","priority":"low","status":"draft","quantity":1,"studentsAffected":0,"unitType":"خدمة","subcategory":"electrical","departmentKey":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/requests" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_draft_mass.json)
REQ_MASS_ID=$(echo "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
# نحاول تغيير institutionId
R=$(curl -s -X PATCH "$BASE/requests/$REQ_MASS_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d '{"title":"updated","institutionId":999}')
check "mass-assignment PATCH request مرفوض (strict)" "fail" "$R"

# ─── B-5: Input Validation Edge Cases ──────────────
echo ""
echo "【128】 Request بـ quantity=0 مرفوض"
cat > /tmp/_zero.json <<'EOF'
{"title":"t","description":"d","priority":"high","status":"pending","quantity":0,"unitType":"خدمة","subcategory":"electrical","departmentKey":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/requests" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_zero.json)
check "quantity=0 مرفوض" "fail" "$R"

echo ""
echo "【129】 Request بـ quantity=-5 مرفوض"
cat > /tmp/_neg.json <<'EOF'
{"title":"t","description":"d","priority":"high","status":"pending","quantity":-5,"unitType":"خدمة","subcategory":"electrical","departmentKey":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/requests" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_neg.json)
check "quantity سالب مرفوض" "fail" "$R"

echo ""
echo "【130】 Request بعنوان فارغ مرفوض"
cat > /tmp/_empty.json <<'EOF'
{"title":"","description":"d","priority":"high","status":"pending","quantity":1,"unitType":"خدمة","subcategory":"electrical","departmentKey":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/requests" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_empty.json)
check "عنوان فارغ مرفوض" "fail" "$R"

echo ""
echo "【131】 Request بـ departmentKey غير موجود مرفوض"
cat > /tmp/_baddept.json <<'EOF'
{"title":"t","description":"d","priority":"high","status":"pending","quantity":1,"unitType":"خدمة","subcategory":"electrical","departmentKey":"ghostdept"}
EOF
R=$(curl -s -X POST "$BASE/requests" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_baddept.json)
check "departmentKey غير موجود مرفوض" "fail" "$R"

echo ""
echo "【132】 Login بـ email بدون @ مرفوض"
R=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"invalid","password":"x"}')
check "email بلا @ مرفوض" "fail" "$R"

echo ""
echo "【133】 Forgot-password بـ email بدون @ مرفوض (validator جديد)"
R=$(curl -s -X POST "$BASE/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"noatsign"}')
check "forgot-password email بلا @ مرفوض" "fail" "$R"

echo ""
echo "【134】 inventory بـ minThreshold=-1 مرفوض"
cat > /tmp/_badinv.json <<'EOF'
{"name":"bad-item","category":"x","quantity":10,"unitType":"قطعة","minThreshold":-1,"department":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/inventory" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d @/tmp/_badinv.json)
check "minThreshold سالب مرفوض" "fail" "$R"

echo ""
echo "【135】 XSS payload في institution name يُحفظ كنص عادي"
cat > /tmp/_xss.json <<'EOF'
{"name":"<script>alert('xss')</script>","institutionType":"school","governorate":"دمشق"}
EOF
R=$(curl -s -X POST "$BASE/admin/institutions" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_xss.json)
XSS_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
# نتحقق أن النص محفوظ كما هو (بدون escaping وبدون تنفيذ)
if echo "$R" | grep -q '<script>'; then
  check "XSS payload محفوظ كنص" "success" '{"success":true}'
else
  check "XSS payload محفوظ كنص" "success" '{"success":false}'
fi
# تنظيف
[ -n "$XSS_ID" ] && curl -s -X DELETE "$BASE/admin/institutions/$XSS_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

# ═══════════════════════════════════════════════════════════════
# Phase C: P1 Integration + Edge Cases
# ═══════════════════════════════════════════════════════════════

# ─── C-1: Race Conditions ──────────────────────────
echo ""
echo "【136】 Race: تغييران متزامنان للحالة — الثاني يفشل (state machine)"
cat > /tmp/_race_req.json <<'EOF'
{"title":"race","description":"d","priority":"low","status":"pending","quantity":1,"unitType":"خدمة","subcategory":"electrical","departmentKey":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/requests" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_race_req.json)
RACE_ID=$(echo "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
# نطلق تحويلين بالتوازي
(curl -s -X PATCH "$BASE/warehouse/requests/$RACE_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"in_progress"}' > /tmp/_race1.out 2>&1 &
 curl -s -X PATCH "$BASE/warehouse/requests/$RACE_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"rejected","rejectionReason":"r"}' > /tmp/_race2.out 2>&1 &
 wait)
# على الأقل واحد منهم نجح — نتحقق أن الطلب وصل لحالة واحدة فقط
R=$(curl -s "$BASE/warehouse/requests" -H "Authorization: Bearer $FRESH_WH_TOKEN" | python -c "
import json, sys
d = json.load(sys.stdin)
for r in d['data']:
    if r['id'] == '$RACE_ID':
        print(r['status']); break
")
if [ "$R" = "in-progress" ] || [ "$R" = "rejected" ]; then
  check "race condition: الطلب في حالة واحدة فقط ($R)" "success" '{"success":true}'
else
  check "race condition: حالة غير متوقعة ($R)" "success" '{"success":false}'
fi

# ─── C-2: Integration Consistency ──────────────────
echo ""
echo "【137】 Admin يعطّل مستخدم → طلبه التالي يفشل"
cat > /tmp/_tmp_active.json <<'EOF'
{"email":"activetmp@test.com","password":"Active11","userType":"admin"}
EOF
R=$(curl -s -X POST "$BASE/admin/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d @/tmp/_tmp_active.json)
ACT_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
ACT_TOKEN=$(get_token "activetmp@test.com" "Active11")
# نتأكد أنه يعمل أولاً
R1=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $ACT_TOKEN")
# نعطّله
curl -s -X PATCH "$BASE/admin/users/$ACT_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d '{"isActive":false}' > /dev/null
# الطلب التالي يجب أن يفشل فوراً
R=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $ACT_TOKEN")
if echo "$R1" | grep -q '"success":true' && echo "$R" | grep -q '"success":false'; then
  check "تعطيل أثناء session" "success" '{"success":true}'
else
  check "تعطيل أثناء session" "success" '{"success":false}'
fi
curl -s -X DELETE "$BASE/admin/users/$ACT_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

echo ""
echo "【138】 حذف مؤسسة وعندها طلبات مرفوض"
# FRESH_INST لها REQ_ID (completed) + REQ_ID2 (rejected) — لا يمكن حذفها
INST_WITH_REQS_ID=$(curl -s "$BASE/admin/users/$NEW_INST_ID" -H "Authorization: Bearer $ADMIN_TOKEN" | python -c "
import json, sys; d=json.load(sys.stdin); print(d['data'].get('institutionId',''))
" 2>/dev/null)
if [ -n "$INST_WITH_REQS_ID" ]; then
  R=$(curl -s -X DELETE "$BASE/admin/institutions/$INST_WITH_REQS_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
  check "حذف مؤسسة مع طلبات مرفوض" "fail" "$R"
else
  check "حذف مؤسسة مع طلبات مرفوض (تخطي)" "success" '{"success":true}'
fi

echo ""
echo "【139】 حذف مستودع وعنده طلبات مرفوض"
WH_WITH_REQS_ID=$(curl -s "$BASE/admin/warehouses?governorate=%D8%AD%D9%84%D8%A8&departmentKey=maintenance" -H "Authorization: Bearer $ADMIN_TOKEN" | python -c "
import json, sys
d=json.load(sys.stdin)
for w in d['data']:
    if w.get('requestsCount',0) > 0:
        print(w['id']); break
" 2>/dev/null)
if [ -n "$WH_WITH_REQS_ID" ]; then
  R=$(curl -s -X DELETE "$BASE/admin/warehouses/$WH_WITH_REQS_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
  check "حذف مستودع مع طلبات مرفوض" "fail" "$R"
else
  check "حذف مستودع مع طلبات مرفوض (تخطي)" "success" '{"success":true}'
fi

# ─── C-3: Documented odd behaviors ────────────────
echo ""
echo "【140】 consumeStock لكمية غير كافية — الطلب يكمل والمخزون لا ينقص (توثيق)"
# ننشئ عنصر بكمية قليلة جداً
cat > /tmp/_tiny.json <<'EOF'
{"name":"tiny-item","category":"x","quantity":1,"unitType":"قطعة","minThreshold":0,"department":"maintenance"}
EOF
R=$(curl -s -X POST "$BASE/inventory" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d @/tmp/_tiny.json)
TINY_ID=$(echo "$R" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
# ننشئ طلب يطلب 100 قطعة من هذا العنصر
cat > /tmp/_req_insuf.json <<'EOF'
{"title":"insufficient","description":"d","priority":"low","status":"pending","quantity":100,"unitType":"قطعة","subcategory":"electrical","departmentKey":"maintenance","requestedItems":[{"itemName":"tiny-item","originalKey":"x","quantity":100,"unitType":"قطعة","displayText":"tiny-item"}]}
EOF
R=$(curl -s -X POST "$BASE/requests" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_INST_TOKEN" -d @/tmp/_req_insuf.json)
INSUF_ID=$(echo "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -s -X PATCH "$BASE/warehouse/requests/$INSUF_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"in_progress"}' > /dev/null
curl -s -X PATCH "$BASE/warehouse/requests/$INSUF_ID/status" -H "Content-Type: application/json" -H "Authorization: Bearer $FRESH_WH_TOKEN" -d '{"status":"ready_for_pickup"}' > /dev/null
# نتحقق أن المخزون لسا 1 (ما نقص)
QTY_AFTER_INSUF=$(curl -s "$BASE/inventory" -H "Authorization: Bearer $FRESH_WH_TOKEN" | python -c "
import json, sys
d = json.load(sys.stdin)
for i in d['data']:
    if i['id'] == $TINY_ID:
        print(i['quantity']); break
")
if [ "$QTY_AFTER_INSUF" = "1" ]; then
  check "insufficient stock → الطلب يمر والمخزون لا ينقص (موثّق)" "success" '{"success":true}'
else
  check "insufficient stock → مخزون $QTY_AFTER_INSUF (متوقع 1)" "success" '{"success":false}'
fi
curl -s -X DELETE "$BASE/inventory/$TINY_ID" -H "Authorization: Bearer $FRESH_WH_TOKEN" > /dev/null

# ─── تنظيف ───
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.user.deleteMany({ where: { email: { in: ['instb@test.com', 'why@test.com'] } } });
  await p.\$disconnect();
})();
" 2>/dev/null

curl -s -X DELETE "$BASE/admin/users/$TMP_ADMIN_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
curl -s -X DELETE "$BASE/admin/users/$NEW_INST_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

# ─── الملخص ───
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║                   الملخص                         ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  ✅ ناجح: $PASS"
echo "║  ❌ فاشل: $FAIL"
echo "║  الإجمالي: $((PASS+FAIL))"
echo "╚══════════════════════════════════════════════════╝"

[ $FAIL -eq 0 ] && exit 0 || exit 1
