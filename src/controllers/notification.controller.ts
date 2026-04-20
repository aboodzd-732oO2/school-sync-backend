import { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
import { success, error } from '../utils/apiResponse';

function qs(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

export async function list(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const unreadOnly = qs(req.query.unreadOnly) === 'true';
    const page = qs(req.query.page) ? parseInt(qs(req.query.page)!) : undefined;
    const pageSize = qs(req.query.pageSize) ? parseInt(qs(req.query.pageSize)!) : undefined;
    const data = await notificationService.listNotifications(userId, { unreadOnly, page, pageSize });
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function markRead(req: Request, res: Response) {
  try {
    await notificationService.markAsRead(req.user!.userId, parseInt(String(req.params.id)));
    return success(res, { message: 'تم' });
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function markAllRead(req: Request, res: Response) {
  try {
    await notificationService.markAllAsRead(req.user!.userId);
    return success(res, { message: 'تم' });
  } catch (err: any) {
    return error(res, err.message);
  }
}
