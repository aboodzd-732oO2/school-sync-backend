import { Request, Response } from 'express';
import * as inventoryService from '../services/inventory.service';
import { success, error } from '../utils/apiResponse';

function qs(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

function paramId(req: Request): number {
  return parseInt(String(req.params.id));
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
    const item = await inventoryService.addInventoryItem(req.user!.warehouseId!, req.body);
    return success(res, item, 201);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const item = await inventoryService.updateInventoryItem(paramId(req), req.user!.warehouseId!, req.body);
    return success(res, item);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await inventoryService.deleteInventoryItem(paramId(req), req.user!.warehouseId!);
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
