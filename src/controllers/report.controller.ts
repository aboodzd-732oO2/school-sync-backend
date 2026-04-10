import { Request, Response } from 'express';
import * as reportService from '../services/report.service';
import { success, error } from '../utils/apiResponse';

function paramId(req: Request): number {
  return parseInt(String(req.params.id));
}

export async function list(req: Request, res: Response) {
  try {
    const reports = await reportService.getReports(req.user!.institutionId!);
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
    const report = await reportService.getReportById(paramId(req));
    return success(res, report);
  } catch (err: any) {
    return error(res, err.message, 404);
  }
}
