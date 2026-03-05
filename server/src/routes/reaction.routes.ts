import { Router } from 'express';
import { getReactions, toggleReaction } from '../controllers/reaction.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.use(protect);

router.get('/', getReactions);
router.post('/toggle', toggleReaction);

export default router;
