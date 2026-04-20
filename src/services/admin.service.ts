import bcrypt from 'bcryptjs';
import { prisma } from '../config/db';

interface CreateUserInput {
  email: string;
  password: string;
  userType: 'admin' | 'institution' | 'warehouse';
  institutionId?: number;
  warehouseId?: number;
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error('البريد الإلكتروني مسجل مسبقاً');

  const passwordHash = await bcrypt.hash(input.password, 10);

  if (input.userType === 'admin') {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        userType: 'admin',
        isActive: true,
      }
    });
    return { id: user.id, email: user.email, userType: user.userType };
  } else if (input.userType === 'institution') {
    if (!input.institutionId) throw new Error('يجب اختيار مؤسسة');

    const institution = await prisma.institution.findUnique({ where: { id: input.institutionId } });
    if (!institution) throw new Error('المؤسسة غير موجودة');

    const existingUser = await prisma.user.findUnique({ where: { institutionId: institution.id } });
    if (existingUser) throw new Error('هذه المؤسسة لديها حساب مسبقاً');

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        userType: 'institution',
        isActive: true,
        institutionId: institution.id,
      }
    });
    return { id: user.id, email: user.email, userType: user.userType };
  } else {
    // warehouse
    if (!input.warehouseId) throw new Error('يجب اختيار مستودع');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse) throw new Error('المستودع غير موجود');

    const existingUser = await prisma.user.findUnique({ where: { warehouseId: warehouse.id } });
    if (existingUser) throw new Error('هذا المستودع لديه حساب مسبقاً');

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        userType: 'warehouse',
        isActive: true,
        warehouseId: warehouse.id,
      }
    });
    return { id: user.id, email: user.email, userType: user.userType };
  }
}

export async function listUsers(filters?: { userType?: string; isActive?: boolean; page?: number; pageSize?: number }) {
  const where: any = {};
  if (filters?.userType) where.userType = filters.userType;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  const include = {
    institution: { include: { governorate: true } },
    warehouse: { include: { governorate: true, department: true } },
  };
  const orderBy = { createdAt: 'desc' as const };

  if (filters?.page) {
    const page = Math.max(1, filters.page);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, include, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { data: users.map(u => formatUser(u)), total, page, pageSize };
  }

  const users = await prisma.user.findMany({ where, include, orderBy });
  return users.map(u => formatUser(u));
}

export async function getUserById(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      institution: { include: { governorate: true } },
      warehouse: { include: { governorate: true, department: true } },
    }
  });
  if (!user) throw new Error('المستخدم غير موجود');
  return formatUser(user);
}

export async function updateUser(id: number, input: { isActive?: boolean; password?: string; email?: string }) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error('المستخدم غير موجود');

  // حماية: لا يمكن تعطيل آخر أدمن نشط
  if (user.userType === 'admin' && input.isActive === false) {
    const activeAdmins = await prisma.user.count({ where: { userType: 'admin', isActive: true } });
    if (activeAdmins <= 1) throw new Error('لا يمكن تعطيل آخر حساب مدير نشط');
  }

  const data: any = {};
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.email) data.email = input.email;
  if (input.password) data.passwordHash = await bcrypt.hash(input.password, 10);

  const updated = await prisma.user.update({
    where: { id },
    data,
    include: {
      institution: { include: { governorate: true } },
      warehouse: { include: { governorate: true, department: true } },
    }
  });
  return formatUser(updated);
}

export async function deleteUser(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error('المستخدم غير موجود');

  // حماية: لا يمكن حذف آخر أدمن
  if (user.userType === 'admin') {
    const adminCount = await prisma.user.count({ where: { userType: 'admin' } });
    if (adminCount <= 1) throw new Error('لا يمكن حذف آخر حساب مدير');
  }

  await prisma.user.delete({ where: { id } });
}

export async function getStats(days?: number) {
  const requestWhere: any = {};
  let completedWhere: any = { status: 'completed' };
  if (days && days > 0) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    requestWhere.dateSubmitted = { gte: since };
    completedWhere = { status: 'completed', dateSubmitted: { gte: since } };
  }

  const [
    institutions,
    warehouses,
    totalRequests,
    inventoryItems,
    byStatusRaw,
    byPriorityRaw,
    byDepartmentRaw,
    byInstitutionRaw,
    byWarehouseRaw,
    priorities,
    departments,
    institutionsList,
    warehousesList,
    completedForAvg,
    studentsAgg,
  ] = await Promise.all([
    prisma.user.count({ where: { userType: 'institution' } }),
    prisma.user.count({ where: { userType: 'warehouse' } }),
    prisma.request.count({ where: requestWhere }),
    prisma.inventoryItem.count(),
    prisma.request.groupBy({ by: ['status'], where: requestWhere, _count: { _all: true } }),
    prisma.request.groupBy({ by: ['priority'], where: requestWhere, _count: { _all: true } }),
    prisma.request.groupBy({ by: ['departmentId'], where: requestWhere, _count: { _all: true } }),
    prisma.request.groupBy({ by: ['institutionId'], where: requestWhere, _count: { _all: true } }),
    prisma.request.groupBy({ by: ['warehouseId'], where: requestWhere, _count: { _all: true } }),
    prisma.priority.findMany(),
    prisma.department.findMany(),
    prisma.institution.findMany({ select: { id: true, name: true } }),
    prisma.warehouse.findMany({ select: { id: true, name: true } }),
    prisma.request.findMany({
      where: completedWhere,
      select: { dateSubmitted: true, updatedAt: true },
    }),
    prisma.request.aggregate({ where: requestWhere, _sum: { studentsAffected: true } }),
  ]);

  const byStatus = {
    draft: 0,
    pending: 0,
    in_progress: 0,
    ready_for_pickup: 0,
    completed: 0,
    rejected: 0,
    cancelled: 0,
    undelivered: 0,
  };
  for (const row of byStatusRaw) {
    byStatus[row.status as keyof typeof byStatus] = row._count._all;
  }

  const priorityMap = new Map(priorities.map(p => [p.key, p]));
  const byPriority = byPriorityRaw
    .map(row => {
      const p = priorityMap.get(row.priority);
      return {
        key: row.priority,
        labelAr: p?.labelAr ?? row.priority,
        color: p?.color ?? '#64748b',
        level: p?.level ?? 1,
        count: row._count._all,
      };
    })
    .sort((a, b) => b.level - a.level || b.count - a.count);

  const deptMap = new Map(departments.map(d => [d.id, d]));
  const byDepartment = byDepartmentRaw
    .map(row => {
      const d = deptMap.get(row.departmentId);
      return {
        key: d?.key ?? '',
        labelAr: d?.labelAr ?? 'قسم محذوف',
        icon: d?.icon ?? 'folder',
        color: d?.color ?? '#64748b',
        count: row._count._all,
      };
    })
    .sort((a, b) => b.count - a.count);

  const instMap = new Map(institutionsList.map(i => [i.id, i.name]));
  const byInstitution = byInstitutionRaw
    .map(row => ({
      id: row.institutionId,
      name: instMap.get(row.institutionId) ?? 'محذوفة',
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const whMap = new Map(warehousesList.map(w => [w.id, w.name]));
  const byWarehouse = byWarehouseRaw
    .map(row => ({
      id: row.warehouseId,
      name: whMap.get(row.warehouseId) ?? 'محذوف',
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  let avgResolutionDays: number | null = null;
  if (completedForAvg.length > 0) {
    const sumMs = completedForAvg.reduce(
      (acc, r) => acc + (r.updatedAt.getTime() - r.dateSubmitted.getTime()),
      0,
    );
    avgResolutionDays = +(sumMs / completedForAvg.length / 86_400_000).toFixed(1);
  }

  return {
    users: { institutions, warehouses, total: institutions + warehouses },
    requests: {
      total: totalRequests,
      byStatus,
      byPriority,
      byDepartment,
      byInstitution,
      byWarehouse,
      avgResolutionDays,
      totalStudentsAffected: studentsAgg._sum.studentsAffected ?? 0,
    },
    inventory: { totalItems: inventoryItems },
  };
}

export async function getStatsTrends(days: number = 30) {
  const clampedDays = Math.max(1, Math.min(365, Math.floor(days) || 30));
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (clampedDays - 1));

  const requests = await prisma.request.findMany({
    where: {
      OR: [
        { dateSubmitted: { gte: since } },
        { status: 'completed', updatedAt: { gte: since } },
      ],
    },
    select: { dateSubmitted: true, updatedAt: true, status: true },
  });

  const buckets = new Map<string, { submitted: number; completed: number }>();
  for (let i = 0; i < clampedDays; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { submitted: 0, completed: 0 });
  }

  for (const r of requests) {
    const subKey = r.dateSubmitted.toISOString().slice(0, 10);
    const subBucket = buckets.get(subKey);
    if (subBucket) subBucket.submitted++;
    if (r.status === 'completed') {
      const compKey = r.updatedAt.toISOString().slice(0, 10);
      const compBucket = buckets.get(compKey);
      if (compBucket) compBucket.completed++;
    }
  }

  return Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    submitted: v.submitted,
    completed: v.completed,
  }));
}

// ══════════════ إدارة المؤسسات ══════════════

export async function listInstitutions(filters?: { governorate?: string; type?: string; page?: number; pageSize?: number; includeDeleted?: boolean }) {
  const where: any = {};
  if (!filters?.includeDeleted) where.deletedAt = null;
  if (filters?.governorate) {
    const gov = await prisma.governorate.findUnique({ where: { name: filters.governorate } });
    if (gov) where.governorateId = gov.id;
  }
  if (filters?.type) where.institutionType = filters.type;

  const include = {
    governorate: true,
    user: { select: { id: true, email: true, isActive: true } },
    _count: { select: { requests: true } },
  };
  const orderBy = { name: 'asc' as const };

  const formatInst = (i: any) => ({
    id: i.id,
    name: i.name,
    institutionType: i.institutionType,
    governorate: i.governorate.name,
    governorateId: i.governorateId,
    hasAccount: !!i.user,
    accountEmail: i.user?.email,
    accountActive: i.user?.isActive,
    requestsCount: i._count.requests,
  });

  if (filters?.page) {
    const page = Math.max(1, filters.page);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
    const [total, institutions] = await Promise.all([
      prisma.institution.count({ where }),
      prisma.institution.findMany({ where, include, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { data: institutions.map(formatInst), total, page, pageSize };
  }

  const institutions = await prisma.institution.findMany({ where, include, orderBy });
  return institutions.map(formatInst);
}

export async function createInstitution(input: { name: string; institutionType: string; governorate: string }) {
  const gov = await prisma.governorate.findUnique({ where: { name: input.governorate } });
  if (!gov) throw new Error('المحافظة غير موجودة');

  const validType = await prisma.institutionType.findUnique({ where: { key: input.institutionType } });
  if (!validType) throw new Error('نوع المؤسسة غير موجود');

  const existing = await prisma.institution.findUnique({
    where: { name_governorateId: { name: input.name, governorateId: gov.id } }
  });
  if (existing) {
    if (existing.deletedAt) {
      // المؤسسة كانت محذوفة ناعماً — نستعيدها
      const restored = await prisma.institution.update({
        where: { id: existing.id },
        data: { deletedAt: null, institutionType: input.institutionType },
        include: { governorate: true },
      });
      return {
        id: restored.id,
        name: restored.name,
        institutionType: restored.institutionType,
        governorate: restored.governorate.name,
      };
    }
    throw new Error('المؤسسة موجودة مسبقاً في هذه المحافظة');
  }

  const institution = await prisma.institution.create({
    data: { name: input.name, institutionType: input.institutionType, governorateId: gov.id },
    include: { governorate: true },
  });

  return {
    id: institution.id,
    name: institution.name,
    institutionType: institution.institutionType,
    governorate: institution.governorate.name,
  };
}

export async function updateInstitution(id: number, input: { name?: string; institutionType?: string; governorate?: string }) {
  const institution = await prisma.institution.findUnique({ where: { id } });
  if (!institution) throw new Error('المؤسسة غير موجودة');

  const data: any = {};
  if (input.name) data.name = input.name;
  if (input.institutionType) data.institutionType = input.institutionType;
  if (input.governorate) {
    const gov = await prisma.governorate.findUnique({ where: { name: input.governorate } });
    if (!gov) throw new Error('المحافظة غير موجودة');
    data.governorateId = gov.id;
  }

  const updated = await prisma.institution.update({
    where: { id },
    data,
    include: { governorate: true },
  });

  return {
    id: updated.id,
    name: updated.name,
    institutionType: updated.institutionType,
    governorate: updated.governorate.name,
  };
}

export async function deleteInstitution(id: number) {
  const institution = await prisma.institution.findUnique({
    where: { id },
    include: { _count: { select: { requests: true } }, user: true },
  });
  if (!institution) throw new Error('المؤسسة غير موجودة');

  if (institution._count.requests > 0) {
    throw new Error(`لا يمكن حذف المؤسسة — لديها ${institution._count.requests} طلب. احذف الطلبات أولاً.`);
  }

  // نحذف المستخدم المرتبط أولاً إن وجد
  if (institution.user) {
    await prisma.user.delete({ where: { id: institution.user.id } });
  }

  // Soft delete بدل hard delete
  await prisma.institution.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ══════════════ إدارة المستودعات ══════════════

export async function listWarehouses(filters?: { governorate?: string; departmentKey?: string; page?: number; pageSize?: number; includeDeleted?: boolean }) {
  const where: any = {};
  if (!filters?.includeDeleted) where.deletedAt = null;
  if (filters?.governorate) {
    const gov = await prisma.governorate.findUnique({ where: { name: filters.governorate } });
    if (gov) where.governorateId = gov.id;
  }
  if (filters?.departmentKey) {
    const dept = await prisma.department.findUnique({ where: { key: filters.departmentKey } });
    if (dept) where.departmentId = dept.id;
  }

  const include = {
    governorate: true,
    department: true,
    user: { select: { id: true, email: true, isActive: true } },
    _count: { select: { requests: true, inventory: true } },
  };
  const orderBy = [{ governorate: { name: 'asc' as const } }, { department: { key: 'asc' as const } }];

  const formatWh = (w: any) => ({
    id: w.id,
    name: w.name,
    governorate: w.governorate.name,
    governorateId: w.governorateId,
    departmentKey: w.department.key,
    departmentLabelAr: w.department.labelAr,
    departmentId: w.departmentId,
    hasAccount: !!w.user,
    accountEmail: w.user?.email,
    accountActive: w.user?.isActive,
    requestsCount: w._count.requests,
    inventoryCount: w._count.inventory,
  });

  if (filters?.page) {
    const page = Math.max(1, filters.page);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
    const [total, warehouses] = await Promise.all([
      prisma.warehouse.count({ where }),
      prisma.warehouse.findMany({ where, include, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { data: warehouses.map(formatWh), total, page, pageSize };
  }

  const warehouses = await prisma.warehouse.findMany({ where, include, orderBy });
  return warehouses.map(formatWh);
}

export async function createWarehouse(input: { name: string; departmentKey: string; governorate: string }) {
  const gov = await prisma.governorate.findUnique({ where: { name: input.governorate } });
  if (!gov) throw new Error('المحافظة غير موجودة');

  const dept = await prisma.department.findUnique({ where: { key: input.departmentKey } });
  if (!dept) throw new Error('القسم غير موجود');

  const existing = await prisma.warehouse.findUnique({
    where: { departmentId_governorateId: { departmentId: dept.id, governorateId: gov.id } }
  });
  if (existing) throw new Error('يوجد مستودع مسبقاً لهذا القسم في هذه المحافظة');

  const warehouse = await prisma.warehouse.create({
    data: { name: input.name, departmentId: dept.id, governorateId: gov.id },
    include: { governorate: true, department: true },
  });

  return {
    id: warehouse.id,
    name: warehouse.name,
    governorate: warehouse.governorate.name,
    departmentKey: warehouse.department.key,
  };
}

export async function updateWarehouse(id: number, input: { name?: string }) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id } });
  if (!warehouse) throw new Error('المستودع غير موجود');

  const updated = await prisma.warehouse.update({
    where: { id },
    data: { name: input.name },
    include: { governorate: true, department: true },
  });

  return {
    id: updated.id,
    name: updated.name,
    governorate: updated.governorate.name,
    departmentKey: updated.department.key,
  };
}

export async function deleteWarehouse(id: number) {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: {
      _count: { select: { requests: true, inventory: true } },
      user: true,
    },
  });
  if (!warehouse) throw new Error('المستودع غير موجود');

  if (warehouse._count.requests > 0) {
    throw new Error(`لا يمكن حذف المستودع — لديه ${warehouse._count.requests} طلب.`);
  }

  // نحذف المستخدم المرتبط أولاً إن وجد
  if (warehouse.user) {
    await prisma.user.delete({ where: { id: warehouse.user.id } });
  }
  // نحذف المخزون
  await prisma.inventoryItem.deleteMany({ where: { warehouseId: id } });

  // Soft delete بدل hard delete
  await prisma.warehouse.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ══════════════ إدارة الأقسام ══════════════

export async function listDepartments() {
  const depts = await prisma.department.findMany({
    include: {
      _count: { select: { warehouses: true, requests: true } },
    },
    orderBy: { id: 'asc' },
  });

  return depts.map(d => ({
    id: d.id,
    key: d.key,
    labelAr: d.labelAr,
    color: d.color,
    icon: d.icon,
    warehousesCount: d._count.warehouses,
    requestsCount: d._count.requests,
  }));
}

export async function createDepartment(input: { key: string; labelAr: string; color?: string; icon?: string }) {
  if (!/^[a-z][a-z0-9-]*$/.test(input.key)) {
    throw new Error('المفتاح يجب أن يبدأ بحرف إنجليزي صغير ويحتوي فقط على حروف وأرقام وشرطات');
  }

  const existing = await prisma.department.findUnique({ where: { key: input.key } });
  if (existing) throw new Error('القسم موجود مسبقاً');

  const dept = await prisma.department.create({
    data: {
      key: input.key,
      labelAr: input.labelAr,
      color: input.color || '#64748b',
      icon: input.icon || 'folder',
    },
  });

  return { id: dept.id, key: dept.key, labelAr: dept.labelAr, color: dept.color, icon: dept.icon };
}

export async function updateDepartment(id: number, input: { labelAr?: string; color?: string; icon?: string }) {
  const dept = await prisma.department.findUnique({ where: { id } });
  if (!dept) throw new Error('القسم غير موجود');

  const data: any = {};
  if (input.labelAr) data.labelAr = input.labelAr;
  if (input.color) data.color = input.color;
  if (input.icon) data.icon = input.icon;

  const updated = await prisma.department.update({ where: { id }, data });
  return { id: updated.id, key: updated.key, labelAr: updated.labelAr, color: updated.color, icon: updated.icon };
}

export async function deleteDepartment(id: number) {
  const dept = await prisma.department.findUnique({
    where: { id },
    include: { _count: { select: { warehouses: true, requests: true } } },
  });
  if (!dept) throw new Error('القسم غير موجود');

  if (dept._count.warehouses > 0) {
    throw new Error(`لا يمكن حذف القسم — مرتبط بـ ${dept._count.warehouses} مستودع. احذفها أولاً.`);
  }
  if (dept._count.requests > 0) {
    throw new Error(`لا يمكن حذف القسم — فيه ${dept._count.requests} طلب.`);
  }

  await prisma.department.delete({ where: { id } });
}

// ══════════════ إدارة المحافظات ══════════════

export async function listGovernorates() {
  const govs = await prisma.governorate.findMany({
    include: {
      _count: { select: { institutions: true, warehouses: true } },
    },
    orderBy: { id: 'asc' },
  });

  return govs.map(g => ({
    id: g.id,
    name: g.name,
    institutionsCount: g._count.institutions,
    warehousesCount: g._count.warehouses,
  }));
}

export async function createGovernorate(input: { name: string }) {
  const existing = await prisma.governorate.findUnique({ where: { name: input.name } });
  if (existing) throw new Error('المحافظة موجودة مسبقاً');

  const gov = await prisma.governorate.create({ data: { name: input.name } });
  return { id: gov.id, name: gov.name };
}

export async function updateGovernorate(id: number, input: { name: string }) {
  const gov = await prisma.governorate.findUnique({ where: { id } });
  if (!gov) throw new Error('المحافظة غير موجودة');

  const existing = await prisma.governorate.findUnique({ where: { name: input.name } });
  if (existing && existing.id !== id) throw new Error('هذا الاسم مستخدم مسبقاً');

  const updated = await prisma.governorate.update({ where: { id }, data: { name: input.name } });
  return { id: updated.id, name: updated.name };
}

export async function deleteGovernorate(id: number) {
  const gov = await prisma.governorate.findUnique({
    where: { id },
    include: { _count: { select: { institutions: true, warehouses: true } } },
  });
  if (!gov) throw new Error('المحافظة غير موجودة');

  if (gov._count.institutions > 0) {
    throw new Error(`لا يمكن حذف — فيها ${gov._count.institutions} مؤسسة`);
  }
  if (gov._count.warehouses > 0) {
    throw new Error(`لا يمكن حذف — فيها ${gov._count.warehouses} مستودع`);
  }

  await prisma.governorate.delete({ where: { id } });
}

// ══════════════ إدارة أنواع المؤسسات ══════════════

export async function listInstitutionTypes() {
  const types = await prisma.institutionType.findMany({ orderBy: { id: 'asc' } });
  // عدد المؤسسات لكل نوع
  const withCount = await Promise.all(types.map(async t => {
    const count = await prisma.institution.count({ where: { institutionType: t.key } });
    return { id: t.id, key: t.key, labelAr: t.labelAr, institutionsCount: count };
  }));
  return withCount;
}

export async function createInstitutionType(input: { key: string; labelAr: string }) {
  if (!/^[a-z][a-z0-9-]*$/.test(input.key)) {
    throw new Error('المفتاح: حروف إنجليزية صغيرة + شرطات فقط');
  }
  const existing = await prisma.institutionType.findUnique({ where: { key: input.key } });
  if (existing) throw new Error('النوع موجود مسبقاً');

  const type = await prisma.institutionType.create({ data: input });
  return { id: type.id, key: type.key, labelAr: type.labelAr };
}

export async function updateInstitutionType(id: number, input: { labelAr: string }) {
  const type = await prisma.institutionType.findUnique({ where: { id } });
  if (!type) throw new Error('النوع غير موجود');

  const updated = await prisma.institutionType.update({ where: { id }, data: { labelAr: input.labelAr } });
  return { id: updated.id, key: updated.key, labelAr: updated.labelAr };
}

export async function deleteInstitutionType(id: number) {
  const type = await prisma.institutionType.findUnique({ where: { id } });
  if (!type) throw new Error('النوع غير موجود');

  const count = await prisma.institution.count({ where: { institutionType: type.key } });
  if (count > 0) throw new Error(`لا يمكن حذف — مرتبط بـ ${count} مؤسسة`);

  await prisma.institutionType.delete({ where: { id } });
}

// ══════════════ إدارة عناصر الأقسام ══════════════

export async function listDepartmentItems(filters?: { departmentKey?: string }) {
  const where: any = {};
  if (filters?.departmentKey) {
    const dept = await prisma.department.findUnique({ where: { key: filters.departmentKey } });
    if (dept) where.departmentId = dept.id;
  }

  const items = await prisma.departmentItem.findMany({
    where,
    include: { department: true },
    orderBy: [{ department: { key: 'asc' } }, { key: 'asc' }],
  });

  return items.map(i => ({
    id: i.id,
    key: i.key,
    labelAr: i.labelAr,
    defaultUnit: i.defaultUnit,
    departmentKey: i.department.key,
    departmentLabelAr: i.department.labelAr,
    departmentId: i.departmentId,
  }));
}

export async function createDepartmentItem(input: { key: string; labelAr: string; defaultUnit?: string; departmentKey: string }) {
  if (!/^[a-z][a-z0-9-]*$/.test(input.key)) {
    throw new Error('المفتاح: حروف إنجليزية صغيرة + شرطات فقط');
  }

  const dept = await prisma.department.findUnique({ where: { key: input.departmentKey } });
  if (!dept) throw new Error('القسم غير موجود');

  const existing = await prisma.departmentItem.findUnique({
    where: { key_departmentId: { key: input.key, departmentId: dept.id } }
  });
  if (existing) throw new Error('العنصر موجود مسبقاً في هذا القسم');

  const item = await prisma.departmentItem.create({
    data: {
      key: input.key,
      labelAr: input.labelAr,
      defaultUnit: input.defaultUnit || 'قطعة',
      departmentId: dept.id,
    },
    include: { department: true },
  });

  return {
    id: item.id,
    key: item.key,
    labelAr: item.labelAr,
    defaultUnit: item.defaultUnit,
    departmentKey: item.department.key,
  };
}

export async function updateDepartmentItem(id: number, input: { labelAr?: string; defaultUnit?: string }) {
  const item = await prisma.departmentItem.findUnique({ where: { id } });
  if (!item) throw new Error('العنصر غير موجود');

  const data: any = {};
  if (input.labelAr) data.labelAr = input.labelAr;
  if (input.defaultUnit) data.defaultUnit = input.defaultUnit;

  const updated = await prisma.departmentItem.update({
    where: { id },
    data,
    include: { department: true },
  });

  return {
    id: updated.id,
    key: updated.key,
    labelAr: updated.labelAr,
    defaultUnit: updated.defaultUnit,
    departmentKey: updated.department.key,
  };
}

export async function deleteDepartmentItem(id: number) {
  const item = await prisma.departmentItem.findUnique({ where: { id } });
  if (!item) throw new Error('العنصر غير موجود');
  await prisma.departmentItem.delete({ where: { id } });
}

// ══════════════ إدارة الوحدات ══════════════

export async function listUnits() {
  return prisma.unit.findMany({ orderBy: { id: 'asc' } });
}

export async function createUnit(input: { name: string }) {
  const existing = await prisma.unit.findUnique({ where: { name: input.name } });
  if (existing) throw new Error('الوحدة موجودة مسبقاً');
  return prisma.unit.create({ data: input });
}

export async function updateUnit(id: number, input: { name: string }) {
  const unit = await prisma.unit.findUnique({ where: { id } });
  if (!unit) throw new Error('الوحدة غير موجودة');

  const existing = await prisma.unit.findUnique({ where: { name: input.name } });
  if (existing && existing.id !== id) throw new Error('هذا الاسم مستخدم مسبقاً');

  return prisma.unit.update({ where: { id }, data: input });
}

export async function deleteUnit(id: number) {
  const unit = await prisma.unit.findUnique({ where: { id } });
  if (!unit) throw new Error('الوحدة غير موجودة');
  await prisma.unit.delete({ where: { id } });
}

// ══════════════ إدارة الأولويات ══════════════

export async function listPriorities() {
  const priorities = await prisma.priority.findMany({ orderBy: { id: 'asc' } });
  const withCount = await Promise.all(priorities.map(async p => {
    const count = await prisma.request.count({ where: { priority: p.key } });
    return { ...p, requestsCount: count };
  }));
  return withCount;
}

export async function createPriority(input: { key: string; labelAr: string; color?: string; level?: number }) {
  if (!/^[a-z][a-z0-9-]*$/.test(input.key)) {
    throw new Error('المفتاح: حروف إنجليزية صغيرة + شرطات فقط');
  }
  const existing = await prisma.priority.findUnique({ where: { key: input.key } });
  if (existing) throw new Error('الأولوية موجودة مسبقاً');

  return prisma.priority.create({
    data: {
      key: input.key,
      labelAr: input.labelAr,
      color: input.color || '#64748b',
      level: input.level ?? 1,
    },
  });
}

export async function updatePriority(id: number, input: { labelAr?: string; color?: string; level?: number }) {
  const p = await prisma.priority.findUnique({ where: { id } });
  if (!p) throw new Error('الأولوية غير موجودة');

  const data: any = {};
  if (input.labelAr) data.labelAr = input.labelAr;
  if (input.color) data.color = input.color;
  if (typeof input.level === 'number') data.level = input.level;

  return prisma.priority.update({ where: { id }, data });
}

export async function deletePriority(id: number) {
  const p = await prisma.priority.findUnique({ where: { id } });
  if (!p) throw new Error('الأولوية غير موجودة');

  const count = await prisma.request.count({ where: { priority: p.key } });
  if (count > 0) throw new Error(`لا يمكن حذف — مستخدمة في ${count} طلب`);

  await prisma.priority.delete({ where: { id } });
}

// ══════════════ خريطة التوجيه ══════════════

export async function getRoutingMap() {
  const [governorates, departments, warehouses] = await Promise.all([
    prisma.governorate.findMany({ orderBy: { id: 'asc' } }),
    prisma.department.findMany({ orderBy: { id: 'asc' } }),
    prisma.warehouse.findMany({
      include: {
        _count: { select: { requests: true } },
        user: { select: { isActive: true } },
      },
    }),
  ]);

  // ننشئ خريطة سريعة: "govId-deptId" → warehouse
  const warehouseMap = new Map<string, typeof warehouses[0]>();
  warehouses.forEach(w => warehouseMap.set(`${w.governorateId}-${w.departmentId}`, w));

  const map = governorates.map(gov => ({
    governorateId: gov.id,
    governorateName: gov.name,
    cells: departments.map(dept => {
      const w = warehouseMap.get(`${gov.id}-${dept.id}`);
      return {
        departmentKey: dept.key,
        departmentLabelAr: dept.labelAr,
        exists: !!w,
        warehouseId: w?.id,
        warehouseName: w?.name,
        requestsCount: w?._count.requests || 0,
        hasActiveAccount: !!w?.user?.isActive,
      };
    }),
  }));

  return {
    governorates: governorates.map(g => ({ id: g.id, name: g.name })),
    departments: departments.map(d => ({ key: d.key, labelAr: d.labelAr, icon: d.icon })),
    map,
  };
}

// ══════════════ Helper ══════════════

function formatUser(user: any) {
  const base = {
    id: user.id,
    email: user.email,
    userType: user.userType,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };

  if (user.userType === 'institution' && user.institution) {
    return {
      ...base,
      institutionName: user.institution.name,
      institutionType: user.institution.institutionType,
      governorate: user.institution.governorate.name,
    };
  }
  if (user.userType === 'warehouse' && user.warehouse) {
    return {
      ...base,
      warehouseName: user.warehouse.name,
      governorate: user.warehouse.governorate.name,
      departmentKey: user.warehouse.department.key,
    };
  }
  return base;
}
