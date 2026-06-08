import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { listGoals, createGoal, updateGoal, deleteGoal } from '../controllers/goal.controller';

const router = Router();

router.use(protect);

router.get('/', listGoals);
router.post('/', createGoal);
router.patch('/:id', updateGoal);
router.delete('/:id', deleteGoal);

export default router;
