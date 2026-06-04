import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  logout,
  refreshToken,
  getMe,
  updateMe,
  changePassword,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Strict rate limiter for auth endpoints — 10 attempts per 15 min per IP.
// skipSuccessfulRequests means only failed attempts count toward the limit.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: 'Too many attempts from this IP. Please try again in 15 minutes.',
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.patch('/me/password', protect, changePassword);

export default router;
