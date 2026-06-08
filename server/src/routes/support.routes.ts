import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { submitContact } from '../controllers/support.controller';

const router = Router();

// Public endpoint — tight rate limit to prevent abuse as a spam relay.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many messages from this IP. Please try again later.',
});

router.post('/contact', contactLimiter, submitContact);

export default router;
