import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  listTokens,
  createToken,
  revokeToken,
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getSlack,
  connectSlack,
  updateSlack,
  disconnectSlack,
  testSlack,
} from '../controllers/integrations.controller';

/**
 * In-app management of the developer platform (API tokens + webhooks).
 * Authenticated by the normal user session; admin + plan gating live in the
 * controller. Mounted at /api/integrations.
 */
const router = Router();

router.use(protect);

// API tokens
router.get('/:teamId/tokens', listTokens);
router.post('/:teamId/tokens', createToken);
router.delete('/:teamId/tokens/:id', revokeToken);

// Webhooks
router.get('/:teamId/webhooks', listWebhooks);
router.post('/:teamId/webhooks', createWebhook);
router.patch('/:teamId/webhooks/:id', updateWebhook);
router.delete('/:teamId/webhooks/:id', deleteWebhook);
router.post('/:teamId/webhooks/:id/test', testWebhook);

// Slack
router.get('/:teamId/slack', getSlack);
router.put('/:teamId/slack', connectSlack);
router.patch('/:teamId/slack', updateSlack);
router.delete('/:teamId/slack', disconnectSlack);
router.post('/:teamId/slack/test', testSlack);

export default router;
