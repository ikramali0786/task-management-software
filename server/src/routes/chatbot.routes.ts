import { Router } from 'express';
import multer from 'multer';
import {
  getChatbots,
  createChatbot,
  updateChatbot,
  deleteChatbot,
  sendMessage,
} from '../controllers/chatbot.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// Multer: memory storage, 10 MB limit, allowlist of file types
// fileFilter param types are inferred contextually from multer.Options
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported. Allowed: images, PDF, DOCX, TXT, CSV.'));
    }
  },
});

router.use(protect);

router.get('/', getChatbots);
router.post('/', createChatbot);
router.patch('/:chatbotId', updateChatbot);
router.delete('/:chatbotId', deleteChatbot);
// upload.single('file') runs before sendMessage; if no file is sent, req.file is undefined
router.post('/:chatbotId/chat', upload.single('file'), sendMessage);

export default router;
