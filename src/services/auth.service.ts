import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserType } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/db';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: number, userType: UserType): string {
  return jwt.sign({ userId, userType }, env.JWT_SECRET, { expiresIn: '7d' });
}

interface RegisterInput {
  email: string;
  password: string;
  userType: 'institution' | 'warehouse';
  institutionType?: string;
  governorate?: string;
  institutionName?: string;
  warehouseName?: string;
  warehouseGovernorate?: string;
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error('البريد الإلكتروني مسجل مسبقاً');
  }

  const passwordHash = await hashPassword(input.password);

  if (input.userType === 'institution') {
    const gov = await prisma.governorate.findUnique({ where: { name: input.governorate! } });
    if (!gov) throw new Error('المحافظة غير موجودة');

    // ابحث عن المؤسسة أو أنشئها
    let institution = await prisma.institution.findUnique({
      where: { name_governorateId: { name: input.institutionName!, governorateId: gov.id } }
    });
    if (!institution) {
      institution = await prisma.institution.create({
        data: {
          name: input.institutionName!,
          institutionType: input.institutionType!,
          governorateId: gov.id,
        }
      });
    }

    // تأكد ما في مستخدم مرتبط بالمؤسسة
    const existingUser = await prisma.user.findUnique({ where: { institutionId: institution.id } });
    if (existingUser) throw new Error('هذه المؤسسة مسجلة مسبقاً');

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        userType: 'institution',
        institutionId: institution.id,
      },
      include: { institution: { include: { governorate: true } } }
    });

    const token = signToken(user.id, user.userType);
    return { token, user: formatUserResponse(user) };
  } else {
    // مستودع
    const gov = await prisma.governorate.findUnique({ where: { name: input.warehouseGovernorate! } });
    if (!gov) throw new Error('المحافظة غير موجودة');

    // استخرج نوع المستودع من الاسم (مثل "مستودع المواد والأثاث التعليمي - دمشق")
    const warehouseName = input.warehouseName!;
    const warehouseTypeName = warehouseName.split(' - ')[0];

    // ابحث عن القسم المناسب
    const departmentMap: Record<string, string> = {
      'مستودع المواد والأثاث التعليمي': 'materials',
      'مستودع الصيانة والإصلاح': 'maintenance',
      'مستودع المواد الأكاديمية والكتب': 'academic-materials',
      'مستودع التقنيات التعليمية': 'technology',
      'مستودع السلامة والأمان': 'safety',
    };

    const deptKey = departmentMap[warehouseTypeName];
    if (!deptKey) throw new Error('نوع المستودع غير صالح');

    const dept = await prisma.department.findUnique({ where: { key: deptKey } });
    if (!dept) throw new Error('القسم غير موجود');

    // ابحث عن المستودع أو أنشئه
    let warehouse = await prisma.warehouse.findUnique({
      where: { departmentId_governorateId: { departmentId: dept.id, governorateId: gov.id } }
    });
    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          name: warehouseName,
          departmentId: dept.id,
          governorateId: gov.id,
        }
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { warehouseId: warehouse.id } });
    if (existingUser) throw new Error('هذا المستودع مسجل مسبقاً');

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        userType: 'warehouse',
        warehouseId: warehouse.id,
      },
      include: { warehouse: { include: { governorate: true, department: true } } }
    });

    const token = signToken(user.id, user.userType);
    return { token, user: formatUserResponse(user) };
  }
}

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
