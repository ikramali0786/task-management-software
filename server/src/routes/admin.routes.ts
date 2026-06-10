import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../utils/admin';
import {
  getStats,
  listUsers,
  getUser,
  setTeamPlan,
  resendVerification,
  forceVerifyUser,
} from '../controllers/admin.controller';

/**
 * Internal admin/support panel — mounted at /api/admin. Every route requires a
 * logged-in user who is also on the SUPER_ADMIN_EMAILS allowlist.
 */
const router = Router();

router.use(protect);
router.use(requireSuperAdmin);

router.get('/stats', getStats);
router.get('/users', listUsers);
router.get('/users/:userId', getUser);
router.post('/users/:userId/resend-verification', resendVerification);
router.post('/users/:userId/verify', forceVerifyUser);
router.patch('/teams/:teamId/plan', setTeamPlan);

export default router;
