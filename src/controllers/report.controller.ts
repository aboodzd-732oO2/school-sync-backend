import { Request, Response } from 'express';
import * as reportService from '../services/report.service';
import { success, error } from '../utils/apiResponse';

function paramId(req: Request): number {
  return parseInt(String(req.params.id));
}

function qs(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

export async function list(req: Request, res: Response) {
  try {
    const yearStr = qs(req.query.year);
    const monthStr = qs(req.query.month);
    const filters: { year?: number; month?: number } = {};
    if (yearStr) filters.year = parseInt(yearStr);
    if (monthStr) filters.month = parseInt(monthStr);
    const reports = await reportService.getReports(req.user!.institutionId!, filters);
    return success(res, reports);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function generate(req: Request, res: Response) {
  try {
    const report = await reportService.generateMonthlyReport(req.user!.institutionId!);
    return success(res, report, 201);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const report = await reportService.getReportById(paramId(req), req.user!.institutionId!);
    return success(res, report);
  } catch (err: any) {
    return error(res, err.message, 404);
  }
}
