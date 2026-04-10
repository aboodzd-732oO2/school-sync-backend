import { Router } from 'express';
import * as requestController from '../controllers/request.controller';
import { authenticate, requireInstitution } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createRequestSchema, updateRequestSchema, updateStatusSchema } from '../validators/request.schema';

const router = Router();

router.use(authenticate, requireInstitution);

router.get('/', requestController.list);
router.post('/', validate(createRequestSchema), requestController.create);
router.get('/:id', requestController.getById);
router.patch('/:id', validate(updateRequestSchema), requestController.update);
router.patch('/:id/status', validate(updateStatusSchema), requestController.updateStatus);
router.delete('/:id', requestController.remove);

export default router;
