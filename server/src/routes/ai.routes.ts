import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.middleware';
import { parseTask, summary, generateSubtasks } from '../controllers/ai.controller';

const router = Router();

router.use(protect);

// AI endpoints call OpenAI — each request costs real money, so they get a
// much tighter limit than the global 500/15min, keyed per authenticated user
// (not IP) so an office NAT doesn't share one bucket and a single abusive
// account can't burn the OpenAI budget.
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user!._id.toString(),
  message: {
    success: false,
    message: 'Too many AI requests. Please wait a few minutes and try again.',
    data: null,
  },
});
router.use(aiLimiter);

router.post('/parse-task', parseTask);
router.post('/summary', summary);
router.post('/generate-subtasks', generateSubtasks);

export default router;
