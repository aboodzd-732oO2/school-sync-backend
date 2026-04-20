import { Request, Response } from 'express';
import * as adminService from '../services/admin.service';
import * as authService from '../services/auth.service';
import { success, error } from '../utils/apiResponse';
import { logAction, listAuditLogs } from '../utils/auditLog';

function paramId(req: Request): number {
  return parseInt(String(req.params.id));
}

function qs(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

export async function createUser(req: Request, res: Response) {
  try {
    const user = await adminService.createUser(req.body);
    await logAction({
      userId: req.user!.userId, userEmail: req.user!.email,
      action: 'create', entityType: 'user', entityId: user.id,
      payload: { email: user.email, userType: user.userType },
    });
    return success(res, user, 201);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function listUsers(req: Request, res: Response) {
  try {
    const filters: any = {};
    const userType = qs(req.query.userType);
    const isActiveStr = qs(req.query.isActive);
    const pageStr = qs(req.query.page);
    const pageSizeStr = qs(req.query.pageSize);
    if (userType) filters.userType = userType;
    if (isActiveStr !== undefined) filters.isActive = isActiveStr === 'true';
    if (pageStr) filters.page = parseInt(pageStr);
    if (pageSizeStr) filters.pageSize = parseInt(pageSizeStr);

    const users = await adminService.listUsers(filters);
    return success(res, users);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    const user = await adminService.getUserById(paramId(req));
    return success(res, user);
  } catch (err: any) {
    return error(res, err.message, 404);
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const user = await adminService.updateUser(paramId(req), req.body);
    const fields = Object.keys(req.body).filter(k => k !== 'password');
    if (req.body.password) fields.push('password');
    await logAction({
      userId: req.user!.userId, userEmail: req.user!.email,
      action: 'update', entityType: 'user', entityId: paramId(req),
      payload: { fields },
    });
    return success(res, user);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    await adminService.deleteUser(paramId(req));
    await logAction({
      userId: req.user!.userId, userEmail: req.user!.email,
      action: 'delete', entityType: 'user', entityId: paramId(req),
    });
    return success(res, { message: 'تم حذف المستخدم' });
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function stats(req: Request, res: Response) {
  try {
    const daysStr = qs(req.query.days);
    const days = daysStr ? parseInt(daysStr) : undefined;
    const data = await adminService.getStats(days && days > 0 ? days : undefined);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function statsTrends(req: Request, res: Response) {
  try {
    const daysStr = qs(req.query.days);
    const days = daysStr ? parseInt(daysStr) : 30;
    const data = await adminService.getStatsTrends(days);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

// ─── Institutions ───
export async function listInstitutions(req: Request, res: Response) {
  try {
    const filters: any = { governorate: qs(req.query.governorate), type: qs(req.query.type) };
    const pageStr = qs(req.query.page);
    const pageSizeStr = qs(req.query.pageSize);
    if (pageStr) filters.page = parseInt(pageStr);
    if (pageSizeStr) filters.pageSize = parseInt(pageSizeStr);
    const data = await adminService.listInstitutions(filters);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function createInstitution(req: Request, res: Response) {
  try {
    const data = await adminService.createInstitution(req.body);
    await logAction({ userId: req.user!.userId, userEmail: req.user!.email,
      action: 'create', entityType: 'institution', entityId: data.id, payload: req.body });
    return success(res, data, 201);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function updateInstitution(req: Request, res: Response) {
  try {
    const data = await adminService.updateInstitution(paramId(req), req.body);
    await logAction({ userId: req.user!.userId, userEmail: req.user!.email,
      action: 'update', entityType: 'institution', entityId: paramId(req), payload: req.body });
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function deleteInstitution(req: Request, res: Response) {
  try {
    await adminService.deleteInstitution(paramId(req));
    await logAction({ userId: req.user!.userId, userEmail: req.user!.email,
      action: 'delete', entityType: 'institution', entityId: paramId(req) });
    return success(res, { message: 'تم حذف المؤسسة' });
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

// ─── Warehouses ───
export async function listWarehouses(req: Request, res: Response) {
  try {
    const filters: any = { governorate: qs(req.query.governorate), departmentKey: qs(req.query.departmentKey) };
    const pageStr = qs(req.query.page);
    const pageSizeStr = qs(req.query.pageSize);
    if (pageStr) filters.page = parseInt(pageStr);
    if (pageSizeStr) filters.pageSize = parseInt(pageSizeStr);
    const data = await adminService.listWarehouses(filters);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function createWarehouse(req: Request, res: Response) {
  try {
    const data = await adminService.createWarehouse(req.body);
    await logAction({ userId: req.user!.userId, userEmail: req.user!.email,
      action: 'create', entityType: 'warehouse', entityId: data.id, payload: req.body });
    return success(res, data, 201);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function updateWarehouse(req: Request, res: Response) {
  try {
    const data = await adminService.updateWarehouse(paramId(req), req.body);
    await logAction({ userId: req.user!.userId, userEmail: req.user!.email,
      action: 'update', entityType: 'warehouse', entityId: paramId(req), payload: req.body });
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function deleteWarehouse(req: Request, res: Response) {
  try {
    await adminService.deleteWarehouse(paramId(req));
    await logAction({ userId: req.user!.userId, userEmail: req.user!.email,
      action: 'delete', entityType: 'warehouse', entityId: paramId(req) });
    return success(res, { message: 'تم حذف المستودع' });
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

// ─── Departments ───
export async function listDepartments(_req: Request, res: Response) {
  try {
    const data = await adminService.listDepartments();
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function createDepartment(req: Request, res: Response) {
  try {
    const data = await adminService.createDepartment(req.body);
    return success(res, data, 201);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function updateDepartment(req: Request, res: Response) {
  try {
    const data = await adminService.updateDepartment(paramId(req), req.body);
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function deleteDepartment(req: Request, res: Response) {
  try {
    await adminService.deleteDepartment(paramId(req));
    return success(res, { message: 'تم حذف القسم' });
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

// ─── Governorates ───
export async function listGovernorates(_req: Request, res: Response) {
  try {
    const data = await adminService.listGovernorates();
    return success(res, data);
  } catch (err: any) { return error(res, err.message); }
}

export async function createGovernorate(req: Request, res: Response) {
  try {
    const data = await adminService.createGovernorate(req.body);
    return success(res, data, 201);
  } catch (err: any) { return error(res, err.message, 400); }
}

export async function updateGovernorate(req: Request, res: Response) {
  try {
    const data = await adminService.updateGovernorate(paramId(req), req.body);
    return success(res, data);
  } catch (err: any) { return error(res, err.message, 400); }
}

export async function deleteGovernorate(req: Request, res: Response) {
  try {
    await adminService.deleteGovernorate(paramId(req));
    return success(res, { message: 'تم حذف المحافظة' });
  } catch (err: any) { return error(res, err.message, 400); }
}

// ─── Institution Types ───
export async function listInstitutionTypes(_req: Request, res: Response) {
  try {
    const data = await adminService.listInstitutionTypes();
    return success(res, data);
  } catch (err: any) { return error(res, err.message); }
}

export async function createInstitutionType(req: Request, res: Response) {
  try {
    const data = await adminService.createInstitutionType(req.body);
    return success(res, data, 201);
  } catch (err: any) { return error(res, err.message, 400); }
}

export async function updateInstitutionType(req: Request, res: Response) {
  try {
    const data = await adminService.updateInstitutionType(paramId(req), req.body);
    return success(res, data);
  } catch (err: any) { return error(res, err.message, 400); }
}

export async function deleteInstitutionType(req: Request, res: Response) {
  try {
    await adminService.deleteInstitutionType(paramId(req));
    return success(res, { message: 'تم حذف النوع' });
  } catch (err: any) { return error(res, err.message, 400); }
}

// ─── Department Items ───
export async function listDepartmentItems(req: Request, res: Response) {
  try {
    const filters = { departmentKey: qs(req.query.departmentKey) };
    const data = await adminService.listDepartmentItems(filters);
    return success(res, data);
  } catch (err: any) { return error(res, err.message); }
}

export async function createDepartmentItem(req: Request, res: Response) {
  try {
    const data = await adminService.createDepartmentItem(req.body);
    return success(res, data, 201);
  } catch (err: any) { return error(res, err.message, 400); }
}

export async function updateDepartmentItem(req: Request, res: Response) {
  try {
    const data = await adminService.updateDepartmentItem(paramId(req), req.body);
    return success(res, data);
  } catch (err: any) { return error(res, err.message, 400); }
}

export async function deleteDepartmentItem(req: Request, res: Response) {
  try {
    await adminService.deleteDepartmentItem(paramId(req));
    return success(res, { message: 'تم حذف العنصر' });
  } catch (err: any) { return error(res, err.message, 400); }
}

// ─── Units ───
export async function listUnits(_req: Request, res: Response) {
  try { return success(res, await adminService.listUnits()); }
  catch (err: any) { return error(res, err.message); }
}
export async function createUnit(req: Request, res: Response) {
  try { return success(res, await adminService.createUnit(req.body), 201); }
  catch (err: any) { return error(res, err.message, 400); }
}
export async function updateUnit(req: Request, res: Response) {
  try { return success(res, await adminService.updateUnit(paramId(req), req.body)); }
  catch (err: any) { return error(res, err.message, 400); }
}
export async function deleteUnit(req: Request, res: Response) {
  try { await adminService.deleteUnit(paramId(req)); return success(res, { message: 'تم الحذف' }); }
  catch (err: any) { return error(res, err.message, 400); }
}

// ─── Priorities ───
export async function listPriorities(_req: Request, res: Response) {
  try { return success(res, await adminService.listPriorities()); }
  catch (err: any) { return error(res, err.message); }
}
export async function createPriority(req: Request, res: Response) {
  try { return success(res, await adminService.createPriority(req.body), 201); }
  catch (err: any) { return error(res, err.message, 400); }
}
export async function updatePriority(req: Request, res: Response) {
  try { return success(res, await adminService.updatePriority(paramId(req), req.body)); }
  catch (err: any) { return error(res, err.message, 400); }
}
export async function deletePriority(req: Request, res: Response) {
  try { await adminService.deletePriority(paramId(req)); return success(res, { message: 'تم الحذف' }); }
  catch (err: any) { return error(res, err.message, 400); }
}

// ─── Routing Map ───
export async function routingMap(_req: Request, res: Response) {
  try {
    const data = await adminService.getRoutingMap();
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

// ─── Audit Logs ───
export async function auditLogs(req: Request, res: Response) {
  try {
    const page = qs(req.query.page) ? parseInt(qs(req.query.page)!) : undefined;
    const pageSize = qs(req.query.pageSize) ? parseInt(qs(req.query.pageSize)!) : undefined;
    const entityType = qs(req.query.entityType);
    const data = await listAuditLogs({ page, pageSize, entityType });
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

// ─── Password Reset Requests ───
export async function listPasswordResets(req: Request, res: Response) {
  try {
    const status = qs(req.query.status);
    const page = qs(req.query.page) ? parseInt(qs(req.query.page)!) : undefined;
    const pageSize = qs(req.query.pageSize) ? parseInt(qs(req.query.pageSize)!) : undefined;
    const data = await authService.listPasswordResets({ status, page, pageSize });
    return success(res, data);
  } catch (err: any) {
    return error(res, err.message);
  }
}

export async function approvePasswordReset(req: Request, res: Response) {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return error(res, 'كلمة المرور الجديدة مطلوبة', 400);
    await authService.approvePasswordReset(paramId(req), newPassword);
    await logAction({
      userId: req.user!.userId, userEmail: req.user!.email,
      action: 'approve-password-reset', entityType: 'passwordReset', entityId: paramId(req),
    });
    return success(res, { message: 'تمت الموافقة وتغيير كلمة المرور' });
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}

export async function rejectPasswordReset(req: Request, res: Response) {
  try {
    await authService.rejectPasswordReset(paramId(req));
    await logAction({
      userId: req.user!.userId, userEmail: req.user!.email,
      action: 'reject-password-reset', entityType: 'passwordReset', entityId: paramId(req),
    });
    return success(res, { message: 'تم الرفض' });
  } catch (err: any) {
    return error(res, err.message, 400);
  }
}
