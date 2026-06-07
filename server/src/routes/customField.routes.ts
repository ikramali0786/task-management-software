import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { listFields, createField, updateField, deleteField } from '../controllers/customField.controller';

const router = Router();

router.use(protect);

router.get('/', listFields);
router.post('/', createField);
router.patch('/:id', updateField);
router.delete('/:id', deleteField);

export default router;
