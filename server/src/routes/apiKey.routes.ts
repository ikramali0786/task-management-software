import { Router } from 'express';
import { getTeamApiKey, setTeamApiKey, deleteTeamApiKey } from '../controllers/apiKey.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/:teamId', getTeamApiKey);
router.post('/:teamId', setTeamApiKey);
router.delete('/:teamId', deleteTeamApiKey);

export default router;
