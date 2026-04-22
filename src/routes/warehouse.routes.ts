import { Router } from 'express';
import * as warehouseController from '../controllers/warehouse.controller';
import { authenticate, requireWarehouse } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateStatusSchema } from '../validators/request.schema';

const router = Router();

router.use(authenticate, requireWarehouse);

router.get('/stats', warehouseController.stats);
router.get('/stats/trends', warehouseController.statsTrends);
router.get('/requests', warehouseController.listRequests);
router.get('/requests/:id/timeline', warehouseController.requestTimeline);
router.patch('/requests/:id/status', validate(updateStatusSchema), warehouseController.updateRequestStatus);

export default router;
