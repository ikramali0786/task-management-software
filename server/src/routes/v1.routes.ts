import { Router } from 'express';
import { apiAuth, requireScope } from '../middleware/apiAuth.middleware';
import {
  apiMe,
  apiListTasks,
  apiGetTask,
  apiCreateTask,
  apiUpdateTask,
  apiDeleteTask,
} from '../controllers/publicApi.controller';

/**
 * Public REST API v1 — token-authenticated, team-scoped. Mounted at /api/v1.
 * Read endpoints need the `read` scope; mutations need `write`.
 */
const router = Router();

router.use(apiAuth);

router.get('/me', apiMe);

router.get('/tasks', requireScope('read'), apiListTasks);
router.get('/tasks/:id', requireScope('read'), apiGetTask);
router.post('/tasks', requireScope('write'), apiCreateTask);
router.patch('/tasks/:id', requireScope('write'), apiUpdateTask);
router.delete('/tasks/:id', requireScope('write'), apiDeleteTask);

export default router;
