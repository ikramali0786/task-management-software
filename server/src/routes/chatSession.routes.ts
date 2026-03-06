import { Router } from 'express';
import { getChatSession, saveChatSession, deleteChatSession } from '../controllers/chatSession.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/:botId', getChatSession);     // Load session from R2
router.put('/:botId', saveChatSession);    // Save (upsert) session to R2
router.delete('/:botId', deleteChatSession); // Delete session from R2

export default router;
