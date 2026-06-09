import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getPublicForm, submitPublicForm, getPublicBoard, getPublicWhiteboard, getPublicDoc } from '../controllers/public.controller';

/**
 * Public, unauthenticated endpoints for shared intake forms and read-only boards.
 * Mounted at /api/public — these routes intentionally do NOT use `protect`.
 */
const router = Router();

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: 'Too many submissions from this IP. Please try again later.',
});

router.get('/forms/:token', getPublicForm);
router.post('/forms/:token/submit', submitLimiter, submitPublicForm);
router.get('/boards/:token', getPublicBoard);
router.get('/whiteboard/:token', getPublicWhiteboard);
router.get('/docs/:token', getPublicDoc);

export default router;
