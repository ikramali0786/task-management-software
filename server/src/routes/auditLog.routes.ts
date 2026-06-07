import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { listAuditLog } from '../controllers/auditLog.controller';

const router = Router();

router.use(protect);
router.get('/', listAuditLog);

export default router;
