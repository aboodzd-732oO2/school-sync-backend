import { Request, Response } from 'express';
import * as institutionService from '../services/institution.service';
import { success, error } from '../utils/apiResponse';

function qs(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

export async function stats(req: Request, res: Response) {
  try {
    const daysStr = qs(req.query.days);
    const days = daysStr ? parseInt(daysStr) : undefined;
    const data = await institutionService.getInstitutionStats(
      req.user!.institutionId!,
      days && days > 0 ? days : undefined,
    );
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function statsTrends(req: Request, res: Response) {
  try {
    const daysStr = qs(req.query.days);
    const days = daysStr ? parseInt(daysStr) : 30;
    const data = await institutionService.getInstitutionStatsTrends(
      req.user!.institutionId!,
      days,
    );
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}
