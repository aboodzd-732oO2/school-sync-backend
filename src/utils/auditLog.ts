import { prisma } from '../config/db';

export async function logAction(params: {
  userId?: number;
  userEmail: string;
  action: string;
  entityType: string;
  entityId?: string | number;
  payload?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        userEmail: params.userEmail,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId !== undefined ? String(params.entityId) : null,
        payload: params.payload ?? undefined,
      },
    });
  } catch {
    // لا نريد فشل عملية بسبب فشل السجل
  }
}

export async function listAuditLogs(params: { page?: number; pageSize?: number; entityType?: string }) {
  const where: any = {};
  if (params.entityType) where.entityType = params.entityType;

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 30));

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { data: logs, total, page, pageSize };
}
