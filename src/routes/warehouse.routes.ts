import { Router } from 'express';
import * as warehouseController from '../controllers/warehouse.controller';
import { authenticate, requireWarehouse } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateStatusSchema } from '../validators/request.schema';

const router = Router();

router.use(authenticate, requireWarehouse);

router.get('/requests', warehouseController.listRequests);
router.patch('/requests/:id/status', validate(updateStatusSchema), warehouseController.updateRequestStatus);

export default router;
