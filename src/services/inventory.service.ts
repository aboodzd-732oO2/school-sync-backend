import { prisma } from '../config/db';

interface Actor {
  userId?: number | null;
  userEmail?: string;
}

async function logMovement(data: {
  warehouseId: number;
  inventoryItemId: number | null;
  itemName: string;
  category: string;
  department: string;
  unitType: string;
  reason: string;
  quantityBefore: number;
  quantityAfter: number;
  requestId?: number | null;
  actor?: Actor;
  note?: string;
}) {
  try {
    await prisma.inventoryMovement.create({
      data: {
        warehouseId: data.warehouseId,
        inventoryItemId: data.inventoryItemId,
        itemName: data.itemName,
        category: data.category,
        department: data.department,
        unitType: data.unitType,
        reason: data.reason,
        quantityBefore: data.quantityBefore,
        quantityAfter: data.quantityAfter,
        delta: data.quantityAfter - data.quantityBefore,
        requestId: data.requestId ?? null,
        userId: data.actor?.userId ?? null,
        userEmail: data.actor?.userEmail ?? 'system',
        note: data.note,
      },
    });
  } catch (err) {
    console.error('Failed to log inventory movement:', err);
  }
}

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

export async function addInventoryItem(
  warehouseId: number,
  input: { name: string; category: string; quantity: number; unitType: string; minThreshold?: number; department: string },
  actor?: Actor,
) {
  const existing = await prisma.inventoryItem.findUnique({
    where: { name_department_warehouseId: { name: input.name, department: input.department, warehouseId } }
  });

  if (existing) {
    // merge quantities
    const before = existing.quantity;
    const updated = await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: { quantity: before + input.quantity },
    });
    await logMovement({
      warehouseId,
      inventoryItemId: updated.id,
      itemName: updated.name,
      category: updated.category,
      department: updated.department,
      unitType: updated.unitType,
      reason: 'manual-increase',
      quantityBefore: before,
      quantityAfter: updated.quantity,
      actor,
      note: 'دمج كمية مع عنصر موجود',
    });
    return updated;
  }

  const created = await prisma.inventoryItem.create({
    data: { ...input, warehouseId },
  });
  await logMovement({
    warehouseId,
    inventoryItemId: created.id,
    itemName: created.name,
    category: created.category,
    department: created.department,
    unitType: created.unitType,
    reason: 'create',
    quantityBefore: 0,
    quantityAfter: created.quantity,
    actor,
  });
  return created;
}

export async function updateInventoryItem(
  itemId: number,
  warehouseId: number,
  input: { name?: string; category?: string; quantity?: number; unitType?: string; minThreshold?: number },
  actor?: Actor,
) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('العنصر غير موجود');
  if (item.warehouseId !== warehouseId) throw new Error('غير مصرح');

  const updated = await prisma.inventoryItem.update({ where: { id: itemId }, data: input });

  // Log quantity change if any
  if (input.quantity !== undefined && input.quantity !== item.quantity) {
    const reason = input.quantity > item.quantity ? 'manual-increase' : 'manual-decrease';
    await logMovement({
      warehouseId,
      inventoryItemId: updated.id,
      itemName: updated.name,
      category: updated.category,
      department: updated.department,
      unitType: updated.unitType,
      reason,
      quantityBefore: item.quantity,
      quantityAfter: updated.quantity,
      actor,
      note: 'تعديل يدوي للكمية',
    });
  } else {
    // Log metadata edit if any non-quantity field changed
    const fieldsChanged: string[] = [];
    if (input.name && input.name !== item.name) fieldsChanged.push('name');
    if (input.category && input.category !== item.category) fieldsChanged.push('category');
    if (input.unitType && input.unitType !== item.unitType) fieldsChanged.push('unitType');
    if (input.minThreshold !== undefined && input.minThreshold !== item.minThreshold) fieldsChanged.push('minThreshold');
    if (fieldsChanged.length > 0) {
      await logMovement({
        warehouseId,
        inventoryItemId: updated.id,
        itemName: updated.name,
        category: updated.category,
        department: updated.department,
        unitType: updated.unitType,
        reason: 'edit-meta',
        quantityBefore: item.quantity,
        quantityAfter: item.quantity,
        actor,
        note: `تعديل حقول: ${fieldsChanged.join('، ')}`,
      });
    }
  }

  return updated;
}

export async function deleteInventoryItem(itemId: number, warehouseId: number, actor?: Actor) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('العنصر غير موجود');
  if (item.warehouseId !== warehouseId) throw new Error('غير مصرح');

  await logMovement({
    warehouseId,
    inventoryItemId: null, // will also be set to null by onDelete: SetNull
    itemName: item.name,
    category: item.category,
    department: item.department,
    unitType: item.unitType,
    reason: 'delete',
    quantityBefore: item.quantity,
    quantityAfter: 0,
    actor,
    note: 'حذف العنصر',
  });

  await prisma.inventoryItem.delete({ where: { id: itemId } });
}

export async function getLowStockItems(warehouseId: number) {
  const items = await prisma.inventoryItem.findMany({ where: { warehouseId } });
  return items.filter(item => item.quantity <= item.minThreshold);
}

export async function consumeStock(
  warehouseId: number,
  items: Array<{ itemName: string; quantity: number; department: string }>,
  context?: { requestId?: number; actor?: Actor },
) {
  for (const item of items) {
    const inv = await prisma.inventoryItem.findUnique({
      where: { name_department_warehouseId: { name: item.itemName, department: item.department, warehouseId } }
    });
    if (inv && inv.quantity >= item.quantity) {
      const before = inv.quantity;
      const after = before - item.quantity;
      await prisma.inventoryItem.update({
        where: { id: inv.id },
        data: { quantity: after },
      });
      await logMovement({
        warehouseId,
        inventoryItemId: inv.id,
        itemName: inv.name,
        category: inv.category,
        department: inv.department,
        unitType: inv.unitType,
        reason: 'consume',
        quantityBefore: before,
        quantityAfter: after,
        requestId: context?.requestId,
        actor: context?.actor,
        note: context?.requestId ? `خصم لطلب #${context.requestId}` : undefined,
      });
    }
  }
}

export async function returnStock(
  warehouseId: number,
  items: Array<{ itemName: string; quantity: number; department: string }>,
  context?: { requestId?: number; actor?: Actor; reason?: string },
) {
  for (const item of items) {
    const inv = await prisma.inventoryItem.findUnique({
      where: { name_department_warehouseId: { name: item.itemName, department: item.department, warehouseId } }
    });
    if (inv) {
      const before = inv.quantity;
      const after = before + item.quantity;
      await prisma.inventoryItem.update({
        where: { id: inv.id },
        data: { quantity: after },
      });
      await logMovement({
        warehouseId,
        inventoryItemId: inv.id,
        itemName: inv.name,
        category: inv.category,
        department: inv.department,
        unitType: inv.unitType,
        reason: 'return',
        quantityBefore: before,
        quantityAfter: after,
        requestId: context?.requestId,
        actor: context?.actor,
        note: context?.reason
          ?? (context?.requestId ? `إرجاع من طلب #${context.requestId}` : undefined),
      });
    }
  }
}

export async function getWarehouseMovements(
  warehouseId: number,
  filters?: {
    reason?: string;
    itemId?: number;
    from?: Date;
    to?: Date;
    page?: number;
    pageSize?: number;
  },
) {
  const where: any = { warehouseId };
  if (filters?.reason) where.reason = filters.reason;
  if (filters?.itemId) where.inventoryItemId = filters.itemId;
  if (filters?.from || filters?.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }

  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters?.pageSize ?? 50));

  const [total, data] = await Promise.all([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { data, total, page, pageSize };
}

export async function getInventoryAlerts(warehouseId: number) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 29); // last 30 days (inclusive)

  const [items, consumeRaw] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { warehouseId },
      orderBy: { name: 'asc' },
    }),
    prisma.inventoryMovement.groupBy({
      by: ['inventoryItemId'],
      where: {
        warehouseId,
        reason: 'consume',
        createdAt: { gte: since },
        inventoryItemId: { not: null },
      },
      _sum: { delta: true },
    }),
  ]);

  // delta is signed; for 'consume' it's negative. Convert to positive "consumed units"
  const consumedMap = new Map<number, number>();
  for (const row of consumeRaw) {
    if (row.inventoryItemId === null) continue;
    consumedMap.set(row.inventoryItemId, Math.abs(row._sum.delta ?? 0));
  }

  const withMeta = items.map(item => {
    const consumed30d = consumedMap.get(item.id) ?? 0;
    const avgDailyConsumption = +(consumed30d / 30).toFixed(2);

    // severity
    const halfThreshold = Math.max(1, Math.floor(item.minThreshold / 2));
    let severity: 'out-of-stock' | 'critical' | 'low' | 'healthy';
    if (item.quantity === 0) severity = 'out-of-stock';
    else if (item.quantity <= halfThreshold) severity = 'critical';
    else if (item.quantity <= item.minThreshold) severity = 'low';
    else severity = 'healthy';

    // suggested reorder
    let suggestedReorder = 0;
    if (severity !== 'healthy') {
      const thirtyDayRequirement = Math.ceil(avgDailyConsumption * 30);
      const bufferQty = item.minThreshold * 2;
      // cover current shortfall + 30-day projected consumption, minimum is 2x threshold
      const shortfall = Math.max(0, item.minThreshold - item.quantity);
      suggestedReorder = Math.max(bufferQty, thirtyDayRequirement + shortfall);
    }

    return {
      id: item.id,
      name: item.name,
      category: item.category,
      department: item.department,
      unitType: item.unitType,
      quantity: item.quantity,
      minThreshold: item.minThreshold,
      consumed30d,
      avgDailyConsumption,
      suggestedReorder,
      severity,
    };
  });

  const summary = {
    total: withMeta.length,
    healthy: withMeta.filter(i => i.severity === 'healthy').length,
    low: withMeta.filter(i => i.severity === 'low').length,
    critical: withMeta.filter(i => i.severity === 'critical').length,
    outOfStock: withMeta.filter(i => i.severity === 'out-of-stock').length,
  };

  // Return only items that need attention (non-healthy), sorted by severity then name
  const severityOrder: Record<string, number> = { 'out-of-stock': 0, critical: 1, low: 2, healthy: 3 };
  const items_filtered = withMeta
    .filter(i => i.severity !== 'healthy')
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.name.localeCompare(b.name, 'ar'));

  return { summary, items: items_filtered };
}

export async function getItemHistory(itemId: number, warehouseId: number) {
  // Security: confirm item belongs to this warehouse (if it still exists)
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (item && item.warehouseId !== warehouseId) throw new Error('غير مصرح');

  return prisma.inventoryMovement.findMany({
    where: { warehouseId, inventoryItemId: itemId },
    orderBy: { createdAt: 'desc' },
  });
}
