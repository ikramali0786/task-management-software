import { Router } from 'express';
import {
  getDiscussions,
  createDiscussion,
  updateDiscussion,
  deleteDiscussion,
  togglePin,
} from '../controllers/discussion.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.use(protect);

router.get('/', getDiscussions);
router.post('/', createDiscussion);
router.patch('/:discussionId', updateDiscussion);
router.delete('/:discussionId', deleteDiscussion);
router.patch('/:discussionId/pin', togglePin);

export default router;
