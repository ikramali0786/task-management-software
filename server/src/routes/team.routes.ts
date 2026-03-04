import { Router } from 'express';
import {
  createTeam,
  getMyTeams,
  getTeam,
  updateTeam,
  generateInviteCode,
  joinTeam,
  removeMember,
  updateMemberRole,
  leaveTeam,
} from '../controllers/team.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', getMyTeams);
router.post('/', createTeam);
router.get('/:teamId', getTeam);
router.patch('/:teamId', updateTeam);
router.post('/:teamId/invite', generateInviteCode);
router.post('/:teamId/join', joinTeam);
router.delete('/:teamId/leave', leaveTeam);
router.patch('/:teamId/members/:userId', updateMemberRole);
router.delete('/:teamId/members/:userId', removeMember);

export default router;
