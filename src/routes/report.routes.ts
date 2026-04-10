import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate, requireInstitution } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireInstitution);

router.get('/', reportController.list);
router.post('/generate', reportController.generate);
router.get('/:id', reportController.getById);

export default router;
