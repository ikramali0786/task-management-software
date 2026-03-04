import { Router } from 'express';
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from '../controllers/comment.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', getComments);
router.post('/', createComment);
router.patch('/:commentId', updateComment);
router.delete('/:commentId', deleteComment);

export default router;
