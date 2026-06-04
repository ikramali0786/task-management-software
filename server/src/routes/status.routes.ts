import { Router } from 'express';
import { getStatus } from '../controllers/status.controller';

const router = Router();

// Public — no auth required. Used by the frontend status page.
router.get('/', getStatus);

export default router;
