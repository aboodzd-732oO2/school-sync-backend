import { Request, Response } from 'express';
import * as requestService from '../services/request.service';
import * as inventoryService from '../services/inventory.service';
import { success, error } from '../utils/apiResponse';

function qs(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

function paramId(req: Request): number {
  return parseInt(String(req.params.id));
}

export async function listRequests(req: Request, res: Response) {
  try {
    const filters = {
      status: qs(req.query.status),
      priority: qs(req.query.priority),
      search: qs(req.query.search),
    };
    const requests = await requestService.getWarehouseRequests(req.user!.warehouseId!, filters);
    return success(res, requests);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function updateRequestStatus(req: Request, res: Response) {
  try {
    const statusMap: Record<string, string> = {
      'in-progress': 'in_progress',
      'ready-for-pickup': 'ready_for_pickup',
      'draft': 'draft',
      'pending': 'pending',
      'completed': 'completed',
      'rejected': 'rejected',
      'cancelled': 'cancelled',
      'undelivered': 'undelivered',
    };
    const newStatus = statusMap[req.body.status] || req.body.status;

    // نجيب الحالة القديمة قبل التحديث
    const oldRequest = await requestService.getRequestById(paramId(req));
    const oldStatusMap: Record<string, string> = {
      'in-progress': 'in_progress',
      'ready-for-pickup': 'ready_for_pickup',
    };
    const oldStatus = oldStatusMap[oldRequest.status] || oldRequest.status;

    const result = await requestService.updateRequestStatus(
      paramId(req), newStatus as any,
      { rejectionReason: req.body.rejectionReason, cancellationReason: req.body.cancellationReason, cancellationType: req.body.cancellationType }
    );

    const items = result.requestedItems;
    const warehouseId = req.user!.warehouseId!;

    if (items?.length) {
      const stockItems = items.map((item: any) => ({
        itemName: item.itemName,
        quantity: item.quantity,
        department: result.department,
      }));

      // خصم المخزون عند التجهيز (جاهز للاستلام)
      if (newStatus === 'ready_for_pickup') {
        await inventoryService.consumeStock(warehouseId, stockItems);
      }

      // إرجاع المخزون عند الرجوع من ready_for_pickup إلى in_progress
      if (newStatus === 'in_progress' && oldStatus === 'ready_for_pickup') {
        await inventoryService.returnStock(warehouseId, stockItems);
      }

      // إرجاع المخزون عند عدم الاستلام
      if (newStatus === 'undelivered') {
        await inventoryService.returnStock(warehouseId, stockItems);
      }

      // إرجاع المخزون عند الإلغاء فقط إذا كان سبق وتم الخصم (كان بحالة ready_for_pickup)
      if (newStatus === 'cancelled' && oldStatus === 'ready_for_pickup') {
        await inventoryService.returnStock(warehouseId, stockItems);
      }
    }

    return success(res, result);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}
