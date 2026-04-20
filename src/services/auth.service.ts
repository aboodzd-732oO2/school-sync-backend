import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserType } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { passwordSchema } from '../validators/auth.schema';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: number, userType: UserType): string {
  return jwt.sign({ userId, userType }, env.JWT_SECRET, { expiresIn: '7d' });
}

// NOTE: registerUser removed — self-registration is disabled.
// Users are created via admin.service.createUser (using IDs directly).

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      institution: { include: { governorate: true } },
      warehouse: { include: { governorate: true, department: true } },
    }
  });

  if (!user) throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');

  const token = signToken(user.id, user.userType);
  return { token, user: formatUserResponse(user) };
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // لا نكشف وجود/عدم وجود الحساب — نرجع نجاحاً دائماً
    return;
  }
  // نمنع طلبات متعددة pending لنفس المستخدم
  const existing = await prisma.passwordResetRequest.findFirst({
    where: { userId: user.id, status: 'pending' },
  });
  if (existing) return;

  await prisma.passwordResetRequest.create({
    data: { userId: user.id, userEmail: user.email, status: 'pending' },
  });
}

export async function approvePasswordReset(requestId: number, newPassword: string) {
  const req = await prisma.passwordResetRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new Error('الطلب غير موجود');
  if (req.status !== 'pending') throw new Error('الطلب معالَج مسبقاً');

  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map(i => i.message).join('، '));
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.userId }, data: { passwordHash } }),
    prisma.passwordResetRequest.update({
      where: { id: requestId },
      data: { status: 'approved', resolvedAt: new Date(), newPassword },
    }),
  ]);
}

export async function rejectPasswordReset(requestId: number) {
  const req = await prisma.passwordResetRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new Error('الطلب غير موجود');
  if (req.status !== 'pending') throw new Error('الطلب معالَج مسبقاً');

  await prisma.passwordResetRequest.update({
    where: { id: requestId },
    data: { status: 'rejected', resolvedAt: new Date() },
  });
}

export async function listPasswordResets(params: { status?: string; page?: number; pageSize?: number }) {
  const where: any = {};
  if (params.status) where.status = params.status;

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 30));

  const [total, requests] = await Promise.all([
    prisma.passwordResetRequest.count({ where }),
    prisma.passwordResetRequest.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { data: requests, total, page, pageSize };
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('المستخدم غير موجود');

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new Error('كلمة المرور الحالية غير صحيحة');

  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map(i => i.message).join('، '));
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function getProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      institution: { include: { governorate: true } },
      warehouse: { include: { governorate: true, department: true } },
    }
  });
  if (!user) throw new Error('المستخدم غير موجود');
  return formatUserResponse(user);
}

function formatUserResponse(user: any) {
  if (user.userType === 'admin') {
    return {
      id: user.id,
      email: user.email,
      userType: user.userType,
    };
  }
  if (user.userType === 'institution' && user.institution) {
    return {
      id: user.id,
      email: user.email,
      userType: user.userType,
      institutionType: user.institution.institutionType,
      institutionName: user.institution.name,
      governorate: user.institution.governorate.name,
      institutionId: user.institution.id,
    };
  } else if (user.userType === 'warehouse' && user.warehouse) {
    return {
      id: user.id,
      email: user.email,
      userType: user.userType,
      warehouseName: user.warehouse.name,
      governorate: user.warehouse.governorate.name,
      warehouseId: user.warehouse.id,
      departmentKey: user.warehouse.department.key,
    };
  }
  return { id: user.id, email: user.email, userType: user.userType };
}
