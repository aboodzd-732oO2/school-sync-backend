import { Router } from 'express';
import * as institutionController from '../controllers/institution.controller';
import { authenticate, requireInstitution } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireInstitution);

router.get('/stats', institutionController.stats);
router.get('/stats/trends', institutionController.statsTrends);

export default router;
