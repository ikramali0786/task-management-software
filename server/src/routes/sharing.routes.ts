import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  listForms, createForm, updateForm, deleteForm,
  getBoardShare, enableBoardShare, disableBoardShare,
} from '../controllers/sharing.controller';

/** Admin-gated management of intake forms + the public board. Mounted at /api/sharing. */
const router = Router();

router.use(protect);

// Intake forms
router.get('/:teamId/forms', listForms);
router.post('/:teamId/forms', createForm);
router.patch('/forms/:id', updateForm);
router.delete('/forms/:id', deleteForm);

// Public board
router.get('/:teamId/board', getBoardShare);
router.post('/:teamId/board', enableBoardShare);
router.delete('/:teamId/board', disableBoardShare);

export default router;
