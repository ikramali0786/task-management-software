import { Router } from 'express';
import {
  createTask,
  getTasks,
  getTask,
  updateTask,
  updateTaskStatus,
  updateTaskPosition,
  deleteTask,
  getTaskStats,
  getWorkload,
} from '../controllers/task.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/stats', getTaskStats);
router.get('/workload', getWorkload);
router.get('/', getTasks);
router.post('/', createTask);
router.get('/:taskId', getTask);
router.patch('/:taskId', updateTask);
router.delete('/:taskId', deleteTask);
router.patch('/:taskId/status', updateTaskStatus);
router.patch('/:taskId/position', updateTaskPosition);

export default router;
