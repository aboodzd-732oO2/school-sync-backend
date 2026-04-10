import { prisma } from '../config/db';

export async function getWarehouseInventory(warehouseId: number, filters?: {
  department?: string; search?: string;
}) {
  const where: any = { warehouseId };
  if (filters?.department) where.department = filters.department;
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { category: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return prisma.inventoryItem.findMany({ where, orderBy: { name: 'asc' } });
}

export async function addInventoryItem(warehouseId: number, input: {
  name: string; category: string; quantity: number; unitType: string; minThreshold?: number; department: string;
}) {
  // تحقق من وجود عنصر بنفس الاسم والقسم
  const existing = await prisma.inventoryItem.findUnique({
    where: { name_department_warehouseId: { name: input.name, department: input.department, warehouseId } }
  });

  if (existing) {
    // ادمج الكمية
    return prisma.inventoryItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + input.quantity },
    });
  }

  return prisma.inventoryItem.create({
    data: { ...input, warehouseId },
  });
}

export async function updateInventoryItem(itemId: number, warehouseId: number, input: {
  name?: string; category?: string; quantity?: number; unitType?: string; minThreshold?: number;
}) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('العنصر غير موجود');
  if (item.warehouseId !== warehouseId) throw new Error('غير مصرح');

  return prisma.inventoryItem.update({ where: { id: itemId }, data: input });
}

export async function deleteInventoryItem(itemId: number, warehouseId: number) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('العنصر غير موجود');
  if (item.warehouseId !== warehouseId) throw new Error('غير مصرح');

  await prisma.inventoryItem.delete({ where: { id: itemId } });
}

export async function getLowStockItems(warehouseId: number) {
  const items = await prisma.inventoryItem.findMany({ where: { warehouseId } });
  return items.filter(item => item.quantity <= item.minThreshold);
}

export async function consumeStock(warehouseId: number, items: Array<{ itemName: string; quantity: number; department: string }>) {
  for (const item of items) {
    const inv = await prisma.inventoryItem.findFirst({
      where: { warehouseId, name: { contains: item.itemName, mode: 'insensitive' } }
    });
    if (inv && inv.quantity >= item.quantity) {
      await prisma.inventoryItem.update({
        where: { id: inv.id },
        data: { quantity: inv.quantity - item.quantity },
      });
    }
  }
}

export async function returnStock(warehouseId: number, items: Array<{ itemName: string; quantity: number; department: string }>) {
  for (const item of items) {
    const inv = await prisma.inventoryItem.findFirst({
      where: { warehouseId, name: { contains: item.itemName, mode: 'insensitive' } }
    });
    if (inv) {
      await prisma.inventoryItem.update({
        where: { id: inv.id },
        data: { quantity: inv.quantity + item.quantity },
      });
    }
  }
}
