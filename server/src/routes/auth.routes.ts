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
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  exportMyData,
  deleteAccount,
} from '../controllers/auth.controller';
import {
  setup2fa,
  enable2fa,
  disable2fa,
  regenerateRecoveryCodes,
  verify2faLogin,
} from '../controllers/twoFactor.controller';
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

// Email-triggering endpoints — tighter cap (counts successes too) to prevent
// using TaskFlow as a spam relay against arbitrary inboxes.
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many email requests from this IP. Please try again later.',
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/2fa/login', authLimiter, verify2faLogin);
router.post('/logout', logout);
router.post('/refresh', refreshToken);
router.post('/forgot-password', emailLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', protect, emailLimiter, resendVerification);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.patch('/me/password', protect, changePassword);
router.get('/me/export', protect, exportMyData);
router.delete('/me', protect, deleteAccount);

// Two-factor auth (authenticated management)
router.post('/2fa/setup', protect, setup2fa);
router.post('/2fa/enable', protect, enable2fa);
router.post('/2fa/disable', protect, disable2fa);
router.post('/2fa/recovery-codes', protect, regenerateRecoveryCodes);

export default router;
