import { prisma } from '../config/db';
import { emitToUser } from '../socket';

export async function createNotification(params: {
  userId: number;
  type: string;
  title: string;
  body?: string;
  linkType?: string;
  linkId?: string;
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        linkType: params.linkType,
        linkId: params.linkId,
      },
    });
    emitToUser(params.userId, 'notification:new', notification);
  } catch {
    // لا نفشل العملية الأصلية
  }
}

export async function listNotifications(userId: number, params: { unreadOnly?: boolean; page?: number; pageSize?: number }) {
  const where: any = { userId };
  if (params.unreadOnly) where.read = false;

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));

  const [total, unreadCount, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { data: items, total, unreadCount, page, pageSize };
}

export async function markAsRead(userId: number, id: number) {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== userId) throw new Error('غير مصرح');
  await prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function markAllAsRead(userId: number) {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}
