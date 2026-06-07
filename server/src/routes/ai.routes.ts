import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { parseTask, summary } from '../controllers/ai.controller';

const router = Router();

router.use(protect);

router.post('/parse-task', parseTask);
router.post('/summary', summary);

export default router;
