import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { listRules, createRule, updateRule, deleteRule } from '../controllers/automation.controller';

const router = Router();

router.use(protect);

router.get('/', listRules);
router.post('/', createRule);
router.patch('/:id', updateRule);
router.delete('/:id', deleteRule);

export default router;
