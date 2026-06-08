import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { getWhiteboard, saveWhiteboard } from '../controllers/whiteboard.controller';

const router = Router();

router.use(protect);

router.get('/', getWhiteboard);
router.put('/', saveWhiteboard);

export default router;
