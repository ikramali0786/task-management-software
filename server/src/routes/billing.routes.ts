import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { createCheckoutSession, createPortalSession } from '../controllers/billing.controller';

// NOTE: the Stripe webhook (POST /api/billing/webhook) is mounted directly in
// app.ts with a raw body parser, BEFORE express.json — it must not go through
// this JSON-parsed router.
const router = Router();

router.use(protect);

router.post('/:teamId/checkout', createCheckoutSession);
router.post('/:teamId/portal', createPortalSession);

export default router;
