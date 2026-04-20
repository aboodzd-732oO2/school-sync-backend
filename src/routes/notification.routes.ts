import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', notificationController.list);
router.post('/:id/read', notificationController.markRead);
router.post('/read-all', notificationController.markAllRead);

export default router;
