import { Router } from 'express';
import * as inventoryController from '../controllers/inventory.controller';
import { authenticate, requireWarehouse } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createInventorySchema, updateInventorySchema } from '../validators/inventory.schema';

const router = Router();

router.use(authenticate, requireWarehouse);

router.get('/', inventoryController.list);
router.post('/', validate(createInventorySchema), inventoryController.create);
router.get('/low-stock', inventoryController.lowStock);
router.patch('/:id', validate(updateInventorySchema), inventoryController.update);
router.delete('/:id', inventoryController.remove);

export default router;
