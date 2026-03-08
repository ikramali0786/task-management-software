import { Router } from 'express';
import {
  createTeam,
  getMyTeams,
  getTeam,
  updateTeam,
  generateInviteCode,
  joinTeam,
  joinTeamByCode,
  toggleTeamLock,
  removeMember,
  updateMemberRole,
  leaveTeam,
  getTeamRoles,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  getLabels,
  addLabel,
  updateLabel,
  deleteLabel,
} from '../controllers/team.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', getMyTeams);
router.post('/', createTeam);
router.post('/join', joinTeamByCode);          // join by code only (no teamId needed)
router.get('/:teamId', getTeam);
router.patch('/:teamId', updateTeam);
router.post('/:teamId/invite', generateInviteCode);
router.post('/:teamId/join', joinTeam);
router.patch('/:teamId/lock', toggleTeamLock); // toggle lock
router.delete('/:teamId/leave', leaveTeam);
router.patch('/:teamId/members/:userId', updateMemberRole);
router.delete('/:teamId/members/:userId', removeMember);

// Custom Roles
router.get('/:teamId/roles', getTeamRoles);
router.post('/:teamId/roles', createCustomRole);
router.patch('/:teamId/roles/:roleId', updateCustomRole);
router.delete('/:teamId/roles/:roleId', deleteCustomRole);

// Labels
router.get('/:teamId/labels', getLabels);
router.post('/:teamId/labels', addLabel);
router.patch('/:teamId/labels/:labelId', updateLabel);
router.delete('/:teamId/labels/:labelId', deleteLabel);

export default router;
