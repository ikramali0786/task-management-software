import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  useTemplate,
} from '../controllers/taskTemplate.controller';

const router = Router();

router.use(protect);

router.get('/', listTemplates);
router.post('/', createTemplate);
router.post('/:id/use', useTemplate);
router.patch('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
