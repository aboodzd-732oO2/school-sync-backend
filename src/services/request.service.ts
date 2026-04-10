import { RequestStatus, Priority } from '@prisma/client';
import { prisma } from '../config/db';

// خريطة الأقسام لتوجيه الطلبات تلقائياً
const departmentWarehouseMap: Record<string, string> = {
  'materials': 'مستودع المواد والأثاث التعليمي',
  'maintenance': 'مستودع الصيانة والإصلاح',
  'academic-materials': 'مستودع المواد الأكاديمية والكتب',
  'technology': 'مستودع التقنيات التعليمية',
  'safety': 'مستودع السلامة والأمان',
};

interface CreateRequestInput {
  title: string;
  description: string;
  impact?: string;
  priority: 'high' | 'medium' | 'low';
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

export async function createRequest(institutionId: number, input: CreateRequestInput) {
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

  // إذا ما لقينا مستودع، أنشئه
  if (!warehouse) {
    const warehouseName = `${departmentWarehouseMap[input.departmentKey]} - ${institution.governorate.name}`;
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
      priority: input.priority as Priority,
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
      warehouse: { include: { governorate: true } },
      institution: { include: { governorate: true } },
    }
  });

  return formatRequest(request);
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

export async function getRequestById(requestId: number) {
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
      warehouse: { include: { governorate: true } },
      institution: { include: { governorate: true } },
    }
  });

  return formatRequest(updated);
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
