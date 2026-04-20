import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createUserSchema, updateUserSchema,
  createInstitutionSchema, updateInstitutionSchema,
  createWarehouseSchema, updateWarehouseSchema,
  createDepartmentSchema, updateDepartmentSchema,
  createGovernorateSchema, updateGovernorateSchema,
  createInstitutionTypeSchema, updateInstitutionTypeSchema,
  createDepartmentItemSchema, updateDepartmentItemSchema,
  createUnitSchema, updateUnitSchema,
  createPrioritySchema, updatePrioritySchema,
} from '../validators/admin.schema';

const router = Router();

router.use(authenticate, requireAdmin);

// Stats
router.get('/stats', adminController.stats);
router.get('/stats/trends', adminController.statsTrends);

// Users
router.get('/users', adminController.listUsers);
router.post('/users', validate(createUserSchema), adminController.createUser);
router.get('/users/:id', adminController.getUser);
router.patch('/users/:id', validate(updateUserSchema), adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Institutions
router.get('/institutions', adminController.listInstitutions);
router.post('/institutions', validate(createInstitutionSchema), adminController.createInstitution);
router.patch('/institutions/:id', validate(updateInstitutionSchema), adminController.updateInstitution);
router.delete('/institutions/:id', adminController.deleteInstitution);

// Warehouses
router.get('/warehouses', adminController.listWarehouses);
router.post('/warehouses', validate(createWarehouseSchema), adminController.createWarehouse);
router.patch('/warehouses/:id', validate(updateWarehouseSchema), adminController.updateWarehouse);
router.delete('/warehouses/:id', adminController.deleteWarehouse);

// Departments
router.get('/departments', adminController.listDepartments);
router.post('/departments', validate(createDepartmentSchema), adminController.createDepartment);
router.patch('/departments/:id', validate(updateDepartmentSchema), adminController.updateDepartment);
router.delete('/departments/:id', adminController.deleteDepartment);

// Governorates
router.get('/governorates', adminController.listGovernorates);
router.post('/governorates', validate(createGovernorateSchema), adminController.createGovernorate);
router.patch('/governorates/:id', validate(updateGovernorateSchema), adminController.updateGovernorate);
router.delete('/governorates/:id', adminController.deleteGovernorate);

// Institution Types
router.get('/institution-types', adminController.listInstitutionTypes);
router.post('/institution-types', validate(createInstitutionTypeSchema), adminController.createInstitutionType);
router.patch('/institution-types/:id', validate(updateInstitutionTypeSchema), adminController.updateInstitutionType);
router.delete('/institution-types/:id', adminController.deleteInstitutionType);

// Department Items
router.get('/department-items', adminController.listDepartmentItems);
router.post('/department-items', validate(createDepartmentItemSchema), adminController.createDepartmentItem);
router.patch('/department-items/:id', validate(updateDepartmentItemSchema), adminController.updateDepartmentItem);
router.delete('/department-items/:id', adminController.deleteDepartmentItem);

// Units
router.get('/units', adminController.listUnits);
router.post('/units', validate(createUnitSchema), adminController.createUnit);
router.patch('/units/:id', validate(updateUnitSchema), adminController.updateUnit);
router.delete('/units/:id', adminController.deleteUnit);

// Priorities
router.get('/priorities', adminController.listPriorities);
router.post('/priorities', validate(createPrioritySchema), adminController.createPriority);
router.patch('/priorities/:id', validate(updatePrioritySchema), adminController.updatePriority);
router.delete('/priorities/:id', adminController.deletePriority);

// Routing Map
router.get('/routing-map', adminController.routingMap);

// Audit Logs
router.get('/audit-logs', adminController.auditLogs);

// Password Reset Requests
router.get('/password-resets', adminController.listPasswordResets);
router.post('/password-resets/:id/approve', adminController.approvePasswordReset);
router.post('/password-resets/:id/reject', adminController.rejectPasswordReset);

export default router;
