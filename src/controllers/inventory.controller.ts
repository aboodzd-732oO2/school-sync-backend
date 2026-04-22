import { Request, Response } from 'express';
import * as inventoryService from '../services/inventory.service';
import { success, error } from '../utils/apiResponse';

function qs(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

function paramId(req: Request): number {
  return parseInt(String(req.params.id));
}

function actorFromReq(req: Request) {
  return { userId: req.user!.userId, userEmail: req.user!.email };
}

export async function list(req: Request, res: Response) {
  try {
    const filters = {
      department: qs(req.query.department),
      search: qs(req.query.search),
    };
    const items = await inventoryService.getWarehouseInventory(req.user!.warehouseId!, filters);
    return success(res, items);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const item = await inventoryService.addInventoryItem(
      req.user!.warehouseId!, req.body, actorFromReq(req),
    );
    return success(res, item, 201);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const item = await inventoryService.updateInventoryItem(
      paramId(req), req.user!.warehouseId!, req.body, actorFromReq(req),
    );
    return success(res, item);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await inventoryService.deleteInventoryItem(
      paramId(req), req.user!.warehouseId!, actorFromReq(req),
    );
    return success(res, { message: 'تم حذف العنصر' });
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function lowStock(req: Request, res: Response) {
  try {
    const items = await inventoryService.getLowStockItems(req.user!.warehouseId!);
    return success(res, items);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function movements(req: Request, res: Response) {
  try {
    const filters: any = {
      reason: qs(req.query.reason),
      itemId: qs(req.query.itemId) ? parseInt(qs(req.query.itemId)!) : undefined,
      page: qs(req.query.page) ? parseInt(qs(req.query.page)!) : undefined,
      pageSize: qs(req.query.pageSize) ? parseInt(qs(req.query.pageSize)!) : undefined,
    };
    const fromStr = qs(req.query.from);
    const toStr = qs(req.query.to);
    if (fromStr) filters.from = new Date(fromStr);
    if (toStr) filters.to = new Date(toStr);

    const data = await inventoryService.getWarehouseMovements(req.user!.warehouseId!, filters);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function alerts(req: Request, res: Response) {
  try {
    const data = await inventoryService.getInventoryAlerts(req.user!.warehouseId!);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function itemHistory(req: Request, res: Response) {
  try {
    const data = await inventoryService.getItemHistory(paramId(req), req.user!.warehouseId!);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}
