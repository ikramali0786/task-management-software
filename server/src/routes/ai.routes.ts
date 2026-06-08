import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { parseTask, summary, generateSubtasks } from '../controllers/ai.controller';

const router = Router();

router.use(protect);

router.post('/parse-task', parseTask);
router.post('/summary', summary);
router.post('/generate-subtasks', generateSubtasks);

export default router;
