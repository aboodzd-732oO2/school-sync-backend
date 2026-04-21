import { prisma } from '../config/db';

export async function getWarehouseStats(warehouseId: number, days?: number) {
  const requestWhere: any = { warehouseId, status: { not: 'draft' as const } };
  if (days && days > 0) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    requestWhere.dateSubmitted = { gte: since };
  }

  const [
    totalRequests,
    byStatusRaw,
    byPriorityRaw,
    byInstitutionRaw,
    priorities,
    institutionsList,
    completedForAvg,
    studentsAgg,
    quantityAgg,
    inventoryItems,
    lowStockItems,
  ] = await Promise.all([
    prisma.request.count({ where: requestWhere }),
    prisma.request.groupBy({ by: ['status'], where: requestWhere, _count: { _all: true } }),
    prisma.request.groupBy({ by: ['priority'], where: requestWhere, _count: { _all: true } }),
    prisma.request.groupBy({ by: ['institutionId'], where: requestWhere, _count: { _all: true } }),
    prisma.priority.findMany(),
    prisma.institution.findMany({ select: { id: true, name: true, institutionType: true } }),
    prisma.request.findMany({
      where: {
        warehouseId,
        status: 'completed',
        ...(requestWhere.dateSubmitted ? { dateSubmitted: requestWhere.dateSubmitted } : {}),
      },
      select: { dateSubmitted: true, updatedAt: true },
    }),
    prisma.request.aggregate({ where: requestWhere, _sum: { studentsAffected: true } }),
    prisma.request.aggregate({ where: requestWhere, _sum: { quantity: true } }),
    prisma.inventoryItem.findMany({
      where: { warehouseId },
      select: { quantity: true, minThreshold: true },
    }),
    prisma.inventoryItem.findMany({
      where: { warehouseId },
      select: { id: true, name: true, category: true, quantity: true, minThreshold: true, unitType: true },
    }),
  ]);

  const byStatus = {
    draft: 0,
    pending: 0,
    in_progress: 0,
    ready_for_pickup: 0,
    completed: 0,
    rejected: 0,
    cancelled: 0,
    undelivered: 0,
  };
  for (const row of byStatusRaw) {
    byStatus[row.status as keyof typeof byStatus] = row._count._all;
  }

  const priorityMap = new Map(priorities.map(p => [p.key, p]));
  const byPriority = byPriorityRaw
    .map(row => {
      const p = priorityMap.get(row.priority);
      return {
        key: row.priority,
        labelAr: p?.labelAr ?? row.priority,
        color: p?.color ?? '#64748b',
        level: p?.level ?? 1,
        count: row._count._all,
      };
    })
    .sort((a, b) => b.level - a.level || b.count - a.count);

  const instMap = new Map(institutionsList.map(i => [i.id, i]));
  const byInstitutionAll = byInstitutionRaw.map(row => {
    const inst = instMap.get(row.institutionId);
    return {
      id: row.institutionId,
      name: inst?.name ?? 'محذوفة',
      institutionType: inst?.institutionType ?? 'school',
      count: row._count._all,
    };
  });
  const byInstitution = [...byInstitutionAll]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const schoolCount = byInstitutionAll
    .filter(i => i.institutionType === 'school')
    .reduce((sum, i) => sum + i.count, 0);
  const universityCount = byInstitutionAll
    .filter(i => i.institutionType === 'university')
    .reduce((sum, i) => sum + i.count, 0);
  const highPriorityCount = byPriority
    .filter(p => p.level >= 3 || p.key === 'high' || p.key === 'urgent')
    .reduce((sum, p) => sum + p.count, 0);

  let avgResolutionDays: number | null = null;
  if (completedForAvg.length > 0) {
    const sumMs = completedForAvg.reduce(
      (acc, r) => acc + (r.updatedAt.getTime() - r.dateSubmitted.getTime()),
      0,
    );
    avgResolutionDays = +(sumMs / completedForAvg.length / 86_400_000).toFixed(1);
  }

  const lowStockCount = lowStockItems.filter(i => i.quantity <= i.minThreshold).length;
  const criticalStockCount = lowStockItems.filter(i => i.quantity <= Math.max(1, Math.floor(i.minThreshold / 2))).length;
  const outOfStockCount = lowStockItems.filter(i => i.quantity === 0).length;
  const totalInventoryQuantity = inventoryItems.reduce((sum, i) => sum + i.quantity, 0);
  const inventoryCategories = new Set(lowStockItems.map(i => i.category)).size;

  const criticalStockList = lowStockItems
    .filter(i => i.quantity <= i.minThreshold)
    .sort((a, b) => a.quantity / Math.max(1, a.minThreshold) - b.quantity / Math.max(1, b.minThreshold))
    .slice(0, 5)
    .map(i => ({
      id: i.id,
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      minThreshold: i.minThreshold,
      unitType: i.unitType,
    }));

  return {
    requests: {
      total: totalRequests,
      byStatus,
      byPriority,
      byInstitution,
      avgResolutionDays,
      totalStudentsAffected: studentsAgg._sum.studentsAffected ?? 0,
      totalQuantity: quantityAgg._sum.quantity ?? 0,
      pendingCount: byStatus.pending,
      readyForPickupCount: byStatus.ready_for_pickup,
      highPriorityCount,
      schoolCount,
      universityCount,
    },
    inventory: {
      totalItems: inventoryItems.length,
      totalQuantity: totalInventoryQuantity,
      categories: inventoryCategories,
      lowStockCount,
      criticalStockCount,
      outOfStockCount,
      criticalStockList,
    },
  };
}

export async function getWarehouseStatsTrends(warehouseId: number, days: number = 30) {
  const clampedDays = Math.max(1, Math.min(365, Math.floor(days) || 30));
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (clampedDays - 1));

  const requests = await prisma.request.findMany({
    where: {
      warehouseId,
      OR: [
        { dateSubmitted: { gte: since } },
        { status: 'completed', updatedAt: { gte: since } },
      ],
    },
    select: { dateSubmitted: true, updatedAt: true, status: true },
  });

  const buckets = new Map<string, { submitted: number; completed: number }>();
  for (let i = 0; i < clampedDays; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { submitted: 0, completed: 0 });
  }

  for (const r of requests) {
    const subKey = r.dateSubmitted.toISOString().slice(0, 10);
    const subBucket = buckets.get(subKey);
    if (subBucket) subBucket.submitted++;
    if (r.status === 'completed') {
      const compKey = r.updatedAt.toISOString().slice(0, 10);
      const compBucket = buckets.get(compKey);
      if (compBucket) compBucket.completed++;
    }
  }

  return Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    submitted: v.submitted,
    completed: v.completed,
  }));
}
