import { RequestStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { createNotification } from './notification.service';
import { emitToUsers } from '../socket';

interface StatusLogActor {
  userId?: number | null;
  userEmail: string;
  userType: string;
}

async function logStatusTransition(
  requestId: number,
  fromStatus: RequestStatus | null,
  toStatus: RequestStatus,
  actor: StatusLogActor,
  note?: string,
) {
  try {
    await prisma.requestStatusLog.create({
      data: {
        requestId,
        fromStatus,
        toStatus,
        userId: actor.userId ?? null,
        userEmail: actor.userEmail,
        userType: actor.userType,
        note,
      },
    });
  } catch (err) {
    console.error('Failed to log request status transition:', err);
  }
}

interface CreateRequestInput {
  title: string;
  description: string;
  impact?: string;
  priority: string;
  status?: 'draft' | 'pending';
  quantity: number;
  studentsAffected?: number;
  unitType?: string;
  subcategory: string;
  departmentKey: string;
  requestedItems?: Array<{
    itemName: string;
    originalKey: string;
    quantity: number;
    unitType: string;
    displayText: string;
  }>;
}

export async function createRequest(institutionId: number, input: CreateRequestInput, actor?: StatusLogActor) {
  // ابحث عن المؤسسة لمعرفة المحافظة
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    include: { governorate: true }
  });
  if (!institution) throw new Error('المؤسسة غير موجودة');

  // ابحث عن القسم
  const department = await prisma.department.findUnique({ where: { key: input.departmentKey } });
  if (!department) throw new Error('القسم غير موجود');

  // وجّه الطلب تلقائياً للمستودع المناسب (حسب القسم + المحافظة)
  let warehouse = await prisma.warehouse.findUnique({
    where: { departmentId_governorateId: { departmentId: department.id, governorateId: institution.governorateId } }
  });

  // إذا ما لقينا مستودع، أنشئه باستخدام اسم القسم الديناميكي
  if (!warehouse) {
    const warehouseName = `${department.labelAr.replace(/^قسم\s*/, 'مستودع ')} - ${institution.governorate.name}`;
    warehouse = await prisma.warehouse.create({
      data: {
        name: warehouseName,
        departmentId: department.id,
        governorateId: institution.governorateId,
      }
    });
  }

  const request = await prisma.request.create({
    data: {
      title: input.title,
      description: input.description,
      impact: input.impact,
      priority: input.priority,
      status: (input.status || 'pending') as RequestStatus,
      quantity: input.quantity,
      studentsAffected: input.studentsAffected || 0,
      unitType: input.unitType || 'متنوع',
      subcategory: input.subcategory,
      institutionId,
      departmentId: department.id,
      warehouseId: warehouse.id,
      requestedItems: input.requestedItems ? {
        create: input.requestedItems,
      } : undefined,
    },
    include: {
      requestedItems: true,
      department: true,
      warehouse: { include: { governorate: true, user: true } },
      institution: { include: { governorate: true } },
    }
  });

  const formatted = formatRequest(request);

  // Log creation
  await logStatusTransition(
    request.id,
    null,
    request.status,
    actor ?? { userEmail: 'institution', userType: 'institution' },
    'إنشاء الطلب',
  );

  // إشعار للمستودع عند طلب جديد (فقط إذا الحالة pending)
  if (request.status === 'pending' && request.warehouse?.user?.id) {
    await createNotification({
      userId: request.warehouse.user.id,
      type: 'request-new',
      title: `طلب جديد: ${request.title}`,
      body: `من ${institution.name}`,
      linkType: 'request',
      linkId: String(request.id),
    });
    // بث للمستودع لإضافة الطلب في قائمته فوراً
    emitToUsers([request.warehouse.user.id], 'request:new', formatted);
  }

  return formatted;
}

export async function getInstitutionRequests(institutionId: number, filters?: {
  status?: string; priority?: string; department?: string; search?: string;
}) {
  const where: any = { institutionId };
  if (filters?.status) where.status = filters.status;
  if (filters?.priority) where.priority = filters.priority;
  if (filters?.department) {
    const dept = await prisma.department.findUnique({ where: { key: filters.department } });
    if (dept) where.departmentId = dept.id;
  }
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const requests = await prisma.request.findMany({
    where,
    include: {
      requestedItems: true,
      department: true,
      warehouse: { include: { governorate: true } },
      institution: { include: { governorate: true } },
    },
    orderBy: { dateSubmitted: 'desc' },
  });

  return requests.map(formatRequest);
}

export async function getWarehouseRequests(warehouseId: number, filters?: {
  status?: string; priority?: string; search?: string;
}) {
  const where: any = { warehouseId, status: { not: 'draft' as RequestStatus } };
  if (filters?.status) where.status = filters.status;
  if (filters?.priority) where.priority = filters.priority;
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const requests = await prisma.request.findMany({
    where,
    include: {
      requestedItems: true,
      department: true,
      warehouse: { include: { governorate: true } },
      institution: { include: { governorate: true } },
    },
    orderBy: { dateSubmitted: 'desc' },
  });

  return requests.map(formatRequest);
}

export async function getRequestById(
  requestId: number,
  actor?: { userType: 'admin' | 'institution' | 'warehouse'; institutionId?: number | null; warehouseId?: number | null }
) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      requestedItems: true,
      department: true,
      warehouse: { include: { governorate: true } },
      institution: { include: { governorate: true } },
    }
  });
  if (!request) throw new Error('الطلب غير موجود');

  // فحص الملكية (يمنع IDOR)
  if (actor && actor.userType !== 'admin') {
    if (actor.userType === 'institution' && request.institutionId !== actor.institutionId) {
      throw new Error('الطلب غير موجود');
    }
    if (actor.userType === 'warehouse' && request.warehouseId !== actor.warehouseId) {
      throw new Error('الطلب غير موجود');
    }
  }

  return formatRequest(request);
}

export async function updateRequest(requestId: number, institutionId: number, input: any) {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('الطلب غير موجود');
  if (request.institutionId !== institutionId) throw new Error('غير مصرح');
  if (request.status !== 'draft' && request.status !== 'pending') {
    throw new Error('لا يمكن تعديل طلب في هذه الحالة');
  }

  const { requestedItems, ...data } = input;

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: {
      ...data,
      requestedItems: requestedItems ? {
        deleteMany: {},
        create: requestedItems,
      } : undefined,
    },
    include: {
      requestedItems: true,
      department: true,
      warehouse: { include: { governorate: true } },
      institution: { include: { governorate: true } },
    }
  });

  return formatRequest(updated);
}

export async function updateRequestStatus(requestId: number, status: RequestStatus, extra?: {
  rejectionReason?: string; cancellationReason?: string; cancellationType?: string;
  actor?: StatusLogActor;
}) {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('الطلب غير موجود');

  // تحقق من تسلسل الحالات
  const validTransitions: Record<string, string[]> = {
    draft: ['pending', 'cancelled'],
    pending: ['in_progress', 'rejected', 'cancelled'],
    in_progress: ['ready_for_pickup', 'completed', 'cancelled'],
    ready_for_pickup: ['completed', 'in_progress', 'undelivered'],
    completed: [],
    rejected: [],
    cancelled: [],
    undelivered: ['pending'],
  };

  if (!validTransitions[request.status]?.includes(status)) {
    throw new Error(`لا يمكن تغيير الحالة من ${request.status} إلى ${status}`);
  }

  const updateData: any = { status };
  if (status === 'rejected' && extra?.rejectionReason) {
    updateData.rejectionReason = extra.rejectionReason;
    updateData.rejectionDate = new Date();
  }
  if (status === 'cancelled') {
    updateData.cancellationReason = extra?.cancellationReason;
    updateData.cancellationDate = new Date();
    updateData.cancellationType = extra?.cancellationType;
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: updateData,
    include: {
      requestedItems: true,
      department: true,
      warehouse: { include: { governorate: true, user: true } },
      institution: { include: { governorate: true, user: true } },
    }
  });

  // إشعار للجهة الأخرى عند تغيير الحالة
  const statusLabels: Record<string, string> = {
    pending: 'قيد الانتظار',
    in_progress: 'قيد التنفيذ',
    ready_for_pickup: 'جاهز للاستلام',
    completed: 'مكتمل',
    rejected: 'مرفوض',
    cancelled: 'ملغى',
    undelivered: 'لم يُستلم',
  };
  const targetUserId = status === 'pending' || status === 'cancelled' || status === 'undelivered'
    ? updated.warehouse?.user?.id
    : updated.institution?.user?.id;
  if (targetUserId) {
    await createNotification({
      userId: targetUserId,
      type: 'request-status',
      title: `تحديث طلب: ${updated.title}`,
      body: `الحالة الجديدة: ${statusLabels[status] || status}`,
      linkType: 'request',
      linkId: String(updated.id),
    });
  }

  // Log status transition
  const note = extra?.rejectionReason
    ? `سبب الرفض: ${extra.rejectionReason}`
    : extra?.cancellationReason
      ? `سبب الإلغاء: ${extra.cancellationReason}`
      : undefined;
  await logStatusTransition(
    requestId,
    request.status,
    status,
    extra?.actor ?? { userEmail: 'system', userType: 'system' },
    note,
  );

  const formatted = formatRequest(updated);
  // بث تحديث الحالة للطرفين (المؤسسة والمستودع) لتحديث قوائمهما فوراً
  emitToUsers(
    [updated.institution?.user?.id, updated.warehouse?.user?.id],
    'request:status-changed',
    formatted
  );

  return formatted;
}

export async function getRequestTimeline(
  requestId: number,
  actor?: { userType: 'admin' | 'institution' | 'warehouse'; institutionId?: number | null; warehouseId?: number | null },
) {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('الطلب غير موجود');

  // IDOR guard
  if (actor && actor.userType !== 'admin') {
    if (actor.userType === 'institution' && request.institutionId !== actor.institutionId) {
      throw new Error('الطلب غير موجود');
    }
    if (actor.userType === 'warehouse' && request.warehouseId !== actor.warehouseId) {
      throw new Error('الطلب غير موجود');
    }
  }

  const logs = await prisma.requestStatusLog.findMany({
    where: { requestId },
    orderBy: { createdAt: 'asc' },
  });

  const statusMap: Record<string, string> = {
    draft: 'draft',
    pending: 'pending',
    in_progress: 'in-progress',
    ready_for_pickup: 'ready-for-pickup',
    completed: 'completed',
    rejected: 'rejected',
    cancelled: 'cancelled',
    undelivered: 'undelivered',
  };

  return logs.map(log => ({
    id: log.id,
    fromStatus: log.fromStatus ? statusMap[log.fromStatus] ?? log.fromStatus : null,
    toStatus: statusMap[log.toStatus] ?? log.toStatus,
    userId: log.userId,
    userEmail: log.userEmail,
    userType: log.userType,
    note: log.note,
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function deleteRequest(requestId: number, institutionId: number) {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('الطلب غير موجود');
  if (request.institutionId !== institutionId) throw new Error('غير مصرح');
  if (request.status !== 'draft') throw new Error('لا يمكن حذف طلب غير مسودة');

  await prisma.request.delete({ where: { id: requestId } });
}

// تحويل الطلب لصيغة تتوافق مع الفرونت اند
function formatRequest(request: any) {
  const statusMap: Record<string, string> = {
    draft: 'draft',
    pending: 'pending',
    in_progress: 'in-progress',
    ready_for_pickup: 'ready-for-pickup',
    completed: 'completed',
    rejected: 'rejected',
    cancelled: 'cancelled',
    undelivered: 'undelivered',
  };

  return {
    id: String(request.id),
    title: request.title,
    description: request.description,
    impact: request.impact,
    priority: request.priority,
    status: statusMap[request.status] || request.status,
    quantity: request.quantity,
    studentsAffected: request.studentsAffected,
    unitType: request.unitType,
    subcategory: request.subcategory,
    department: request.department?.key || '',
    location: request.institution?.governorate?.name || '',
    schoolLocation: request.institution?.governorate?.name || '',
    routedTo: request.warehouse?.name || '',
    institutionType: request.institution?.institutionType || '',
    institutionName: request.institution?.name || '',
    dateSubmitted: request.dateSubmitted.toISOString(),
    requestedItems: request.requestedItems || [],
    rejectionReason: request.rejectionReason,
    rejectionDate: request.rejectionDate?.toISOString(),
    cancellationReason: request.cancellationReason,
    cancellationDate: request.cancellationDate?.toISOString(),
    cancellationType: request.cancellationType,
  };
}
