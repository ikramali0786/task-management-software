import { Router } from 'express';
import {
  getChatbots,
  createChatbot,
  updateChatbot,
  deleteChatbot,
  sendMessage,
} from '../controllers/chatbot.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', getChatbots);
router.post('/', createChatbot);
router.patch('/:chatbotId', updateChatbot);
router.delete('/:chatbotId', deleteChatbot);
router.post('/:chatbotId/chat', sendMessage);

export default router;
