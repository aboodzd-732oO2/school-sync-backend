import { z } from 'zod';

export const createInventorySchema = z.object({
  name: z.string().min(1, 'اسم العنصر مطلوب'),
  category: z.string().min(1, 'الفئة مطلوبة'),
  quantity: z.number().int().min(0, 'الكمية لا يمكن أن تكون سالبة'),
  unitType: z.string().min(1, 'نوع الوحدة مطلوب'),
  minThreshold: z.number().int().min(0).default(5),
  department: z.string().min(1, 'القسم مطلوب'),
});

export const updateInventorySchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  quantity: z.number().int().min(0).optional(),
  unitType: z.string().optional(),
  minThreshold: z.number().int().min(0).optional(),
});
