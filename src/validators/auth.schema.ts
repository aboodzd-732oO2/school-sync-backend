import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(4, 'كلمة المرور يجب أن تكون 4 أحرف على الأقل'),
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
