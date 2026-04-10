import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { success, error } from '../utils/apiResponse';

export async function governorates(_req: Request, res: Response) {
  try {
    const data = await prisma.governorate.findMany({ orderBy: { id: 'asc' } });
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function departments(_req: Request, res: Response) {
  try {
    const data = await prisma.department.findMany({ orderBy: { id: 'asc' } });
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function institutions(req: Request, res: Response) {
  try {
    const where: any = {};
    if (req.query.governorate) {
      const gov = await prisma.governorate.findUnique({ where: { name: req.query.governorate as string } });
      if (gov) where.governorateId = gov.id;
    }
    if (req.query.type) where.institutionType = req.query.type;

    const data = await prisma.institution.findMany({
      where,
      include: { governorate: true },
      orderBy: { name: 'asc' },
    });
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function warehouses(req: Request, res: Response) {
  try {
    const where: any = {};
    if (req.query.governorate) {
      const gov = await prisma.governorate.findUnique({ where: { name: req.query.governorate as string } });
      if (gov) where.governorateId = gov.id;
    }

    const data = await prisma.warehouse.findMany({
      where,
      include: { governorate: true, department: true },
      orderBy: { name: 'asc' },
    });
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}
