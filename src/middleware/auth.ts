import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { error } from '../utils/apiResponse';

interface JwtPayload {
  userId: number;
  userType: 'institution' | 'warehouse';
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return error(res, 'غير مصرح - يرجى تسجيل الدخول', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return error(res, 'المستخدم غير موجود', 401);
    }

    req.user = {
      userId: user.id,
      userType: user.userType,
      institutionId: user.institutionId,
      warehouseId: user.warehouseId,
    };
    next();
  } catch {
    return error(res, 'رمز غير صالح أو منتهي الصلاحية', 401);
  }
}

export function requireInstitution(req: Request, res: Response, next: NextFunction) {
  if (req.user?.userType !== 'institution' || !req.user.institutionId) {
    return error(res, 'هذا الإجراء متاح فقط للمؤسسات التعليمية', 403);
  }
  next();
}

export function requireWarehouse(req: Request, res: Response, next: NextFunction) {
  if (req.user?.userType !== 'warehouse' || !req.user.warehouseId) {
    return error(res, 'هذا الإجراء متاح فقط للمستودعات', 403);
  }
  next();
}
