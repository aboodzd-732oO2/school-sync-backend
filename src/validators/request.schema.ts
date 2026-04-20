import { z } from 'zod';

export const createRequestSchema = z.object({
  title: z.string().min(1, 'العنوان مطلوب'),
  description: z.string().min(1, 'الوصف مطلوب'),
  impact: z.string().optional(),
  priority: z.string().min(1, 'الأولوية مطلوبة'),
  status: z.enum(['draft', 'pending']).default('pending'),
  quantity: z.number().int().positive('الكمية يجب أن تكون أكبر من صفر'),
  studentsAffected: z.number().int().min(0).default(0),
  unitType: z.string().default('متنوع'),
  subcategory: z.string().min(1, 'التصنيف الفرعي مطلوب'),
  departmentKey: z.string().min(1, 'القسم مطلوب'),
  requestedItems: z.array(z.object({
    itemName: z.string(),
    originalKey: z.string(),
    quantity: z.number().int().positive(),
    unitType: z.string(),
    displayText: z.string(),
  }).strict()).optional(),
}).strict();

export const updateRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  impact: z.string().optional(),
  priority: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  studentsAffected: z.number().int().min(0).optional(),
  unitType: z.string().optional(),
  subcategory: z.string().optional(),
  requestedItems: z.array(z.object({
    itemName: z.string(),
    originalKey: z.string(),
    quantity: z.number().int().positive(),
    unitType: z.string(),
    displayText: z.string(),
  }).strict()).optional(),
}).strict();

export const updateStatusSchema = z.object({
  status: z.enum(['draft', 'pending', 'in_progress', 'in-progress', 'ready_for_pickup', 'ready-for-pickup', 'completed', 'rejected', 'cancelled', 'undelivered']),
  rejectionReason: z.string().optional(),
  cancellationReason: z.string().optional(),
  cancellationType: z.string().optional(),
}).strict();
