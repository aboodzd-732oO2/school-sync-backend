import { z } from 'zod';
import { passwordSchema } from './auth.schema';

export const createUserSchema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: passwordSchema,
  userType: z.enum(['admin', 'institution', 'warehouse']),
  institutionId: z.number().int().positive().optional(),
  warehouseId: z.number().int().positive().optional(),
}).refine(data => {
  if (data.userType === 'admin') return true;
  if (data.userType === 'institution') return !!data.institutionId;
  if (data.userType === 'warehouse') return !!data.warehouseId;
  return false;
}, { message: 'يجب اختيار مؤسسة أو مستودع' });

export const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  email: z.string().email('بريد إلكتروني غير صالح').optional(),
  password: passwordSchema.optional(),
});

// ─── Institutions ───
export const createInstitutionSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
  institutionType: z.string().min(2, 'نوع المؤسسة مطلوب'),
  governorate: z.string().min(2, 'المحافظة مطلوبة'),
});

export const updateInstitutionSchema = z.object({
  name: z.string().min(2).optional(),
  institutionType: z.string().min(2).optional(),
  governorate: z.string().min(2).optional(),
});

// ─── Warehouses ───
export const createWarehouseSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
  departmentKey: z.string().min(2, 'القسم مطلوب'),
  governorate: z.string().min(2, 'المحافظة مطلوبة'),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
});

// ─── Departments ───
export const createDepartmentSchema = z.object({
  key: z.string().min(2, 'المفتاح مطلوب').regex(/^[a-z][a-z0-9-]*$/, 'المفتاح: حروف صغيرة + شرطات فقط'),
  labelAr: z.string().min(2, 'الاسم العربي مطلوب'),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const updateDepartmentSchema = z.object({
  labelAr: z.string().min(2).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

// ─── Units ───
export const createUnitSchema = z.object({
  name: z.string().min(1, 'اسم الوحدة مطلوب'),
});
export const updateUnitSchema = createUnitSchema;

// ─── Priorities ───
export const createPrioritySchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]*$/, 'المفتاح: حروف صغيرة + شرطات فقط'),
  labelAr: z.string().min(2, 'الاسم العربي مطلوب'),
  color: z.string().optional(),
  level: z.number().int().min(1).optional(),
});
export const updatePrioritySchema = z.object({
  labelAr: z.string().min(2).optional(),
  color: z.string().optional(),
  level: z.number().int().min(1).optional(),
});

// ─── Governorates ───
export const createGovernorateSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
});

export const updateGovernorateSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
});

// ─── Institution Types ───
export const createInstitutionTypeSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]*$/, 'المفتاح: حروف صغيرة + شرطات فقط'),
  labelAr: z.string().min(2, 'الاسم العربي مطلوب'),
});

export const updateInstitutionTypeSchema = z.object({
  labelAr: z.string().min(2, 'الاسم العربي مطلوب'),
});

// ─── Department Items ───
export const createDepartmentItemSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]*$/, 'المفتاح: حروف صغيرة + شرطات فقط'),
  labelAr: z.string().min(1, 'الاسم العربي مطلوب'),
  defaultUnit: z.string().optional(),
  departmentKey: z.string().min(2, 'القسم مطلوب'),
});

export const updateDepartmentItemSchema = z.object({
  labelAr: z.string().min(1).optional(),
  defaultUnit: z.string().optional(),
});
