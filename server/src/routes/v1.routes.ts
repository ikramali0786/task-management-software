import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import { apiAuth, requireScope } from '../middleware/apiAuth.middleware';
import {
  apiMe,
  apiListTasks,
  apiGetTask,
  apiCreateTask,
  apiUpdateTask,
  apiDeleteTask,
} from '../controllers/publicApi.controller';

/**
 * Public REST API v1 — token-authenticated, team-scoped. Mounted at /api/v1.
 * Read endpoints need the `read` scope; mutations need `write`.
 */
const router = Router();

router.use(apiAuth);

// Per-key rate limit (mounted after apiAuth so req.apiToken exists). External
// integrations get a generous-but-bounded budget; the standard RateLimit-*
// headers let well-behaved clients back off before hitting 429s.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.apiToken?._id?.toString() ?? 'unauthenticated',
  message: {
    success: false,
    message: 'Rate limit exceeded: 120 requests per minute per API key.',
    code: 'API_RATE_LIMITED',
    data: null,
  },
});
router.use(apiLimiter);

router.get('/me', apiMe);

router.get('/tasks', requireScope('read'), apiListTasks);
router.get('/tasks/:id', requireScope('read'), apiGetTask);
router.post('/tasks', requireScope('write'), apiCreateTask);
router.patch('/tasks/:id', requireScope('write'), apiUpdateTask);
router.delete('/tasks/:id', requireScope('write'), apiDeleteTask);

export default router;
