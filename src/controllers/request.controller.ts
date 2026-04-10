import { Request, Response } from 'express';
import * as requestService from '../services/request.service';
import { success, error } from '../utils/apiResponse';

function qs(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

function paramId(req: Request): number {
  return parseInt(String(req.params.id));
}

export async function create(req: Request, res: Response) {
  try {
    const result = await requestService.createRequest(req.user!.institutionId!, req.body);
    return success(res, result, 201);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function list(req: Request, res: Response) {
  try {
    const filters = {
      status: qs(req.query.status),
      priority: qs(req.query.priority),
      department: qs(req.query.department),
      search: qs(req.query.search),
    };
    const requests = await requestService.getInstitutionRequests(req.user!.institutionId!, filters);
    return success(res, requests);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const request = await requestService.getRequestById(paramId(req));
    return success(res, request);
  } catch (err: any) {
    return error(res, err.message, 404);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const result = await requestService.updateRequest(paramId(req), req.user!.institutionId!, req.body);
    return success(res, result);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function updateStatus(req: Request, res: Response) {
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
    const status = statusMap[req.body.status] || req.body.status;

    const result = await requestService.updateRequestStatus(
      paramId(req), status as any,
      { rejectionReason: req.body.rejectionReason, cancellationReason: req.body.cancellationReason, cancellationType: req.body.cancellationType }
    );
    return success(res, result);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await requestService.deleteRequest(paramId(req), req.user!.institutionId!);
    return success(res, { message: 'تم حذف الطلب' });
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}
