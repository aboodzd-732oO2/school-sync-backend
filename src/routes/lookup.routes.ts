import { Router } from 'express';
import * as lookupController from '../controllers/lookup.controller';

const router = Router();

// هذي الـ endpoints عامة - ما تحتاج مصادقة
router.get('/governorates', lookupController.governorates);
router.get('/departments', lookupController.departments);
router.get('/institutions', lookupController.institutions);
router.get('/warehouses', lookupController.warehouses);

export default router;
