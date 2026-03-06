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
  addSubtask,
  updateSubtask,
  deleteSubtask,
  reorderSubtasks,
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

// Subtask routes — reorder MUST be before /:subtaskId to avoid param conflict
router.post('/:taskId/subtasks', addSubtask);
router.patch('/:taskId/subtasks/reorder', reorderSubtasks);
router.patch('/:taskId/subtasks/:subtaskId', updateSubtask);
router.delete('/:taskId/subtasks/:subtaskId', deleteSubtask);

export default router;
