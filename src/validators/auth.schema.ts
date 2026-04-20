import { z } from 'zod';

export const passwordSchema = z.string()
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  .regex(/[a-z]/, 'يجب أن تحتوي على حرف إنجليزي صغير')
  .regex(/[A-Z]/, 'يجب أن تحتوي على حرف إنجليزي كبير')
  .regex(/[0-9]/, 'يجب أن تحتوي على رقم');

export const registerSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: passwordSchema,
  userType: z.enum(['institution', 'warehouse']),
  // حقول المؤسسة التعليمية
  institutionType: z.string().optional(),
  governorate: z.string().optional(),
  institutionName: z.string().optional(),
  // حقول المستودع
  warehouseName: z.string().optional(),
  warehouseGovernorate: z.string().optional(),
}).refine(data => {
  if (data.userType === 'institution') {
    return data.institutionType && data.governorate && data.institutionName;
  }
  if (data.userType === 'warehouse') {
    return data.warehouseName && data.warehouseGovernorate;
  }
  return false;
}, { message: 'يرجى ملء جميع الحقول المطلوبة حسب نوع المستخدم' });

export const loginSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح'),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: passwordSchema,
}).strict();
