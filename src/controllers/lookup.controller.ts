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

export async function units(_req: Request, res: Response) {
  try {
    const data = await prisma.unit.findMany({ orderBy: { id: 'asc' } });
    return success(res, data);
  } catch (err: any) { return error(res, err.message); }
}

export async function priorities(_req: Request, res: Response) {
  try {
    const data = await prisma.priority.findMany({ orderBy: { id: 'asc' } });
    return success(res, data);
  } catch (err: any) { return error(res, err.message); }
}

export async function institutionTypes(_req: Request, res: Response) {
  try {
    const data = await prisma.institutionType.findMany({ orderBy: { id: 'asc' } });
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function departmentItems(req: Request, res: Response) {
  try {
    const where: any = {};
    if (req.query.departmentKey) {
      const dept = await prisma.department.findUnique({ where: { key: req.query.departmentKey as string } });
      if (dept) where.departmentId = dept.id;
    }
    const data = await prisma.departmentItem.findMany({
      where,
      include: { department: true },
      orderBy: [{ department: { key: 'asc' } }, { key: 'asc' }],
    });
    return success(res, data.map(i => ({
      id: i.id,
      key: i.key,
      labelAr: i.labelAr,
      defaultUnit: i.defaultUnit,
      departmentKey: i.department.key,
    })));
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
