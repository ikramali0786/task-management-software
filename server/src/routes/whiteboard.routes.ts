import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { getWhiteboard, saveWhiteboard, presignBoardImage } from '../controllers/whiteboard.controller';

const router = Router();

router.use(protect);

router.get('/', getWhiteboard);
router.put('/', saveWhiteboard);
router.post('/image', presignBoardImage);

export default router;
