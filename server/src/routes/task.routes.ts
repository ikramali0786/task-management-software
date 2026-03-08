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
  rebalancePositions,
  bulkUpdateTasks,
  bulkDeleteTasks,
  logTime,
  deleteTimeEntry,
  updateEstimate,
  addDependency,
  removeDependency,
} from '../controllers/task.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

// Stats & workload (must be before /:taskId)
router.get('/stats', getTaskStats);
router.get('/workload', getWorkload);

// Bulk actions (must be before /:taskId)
router.post('/bulk/update', bulkUpdateTasks);
router.post('/bulk/delete', bulkDeleteTasks);

// Kanban position rebalance
router.post('/rebalance', rebalancePositions);

// Task CRUD
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

// Time tracking
router.post('/:taskId/time', logTime);
router.delete('/:taskId/time/:entryId', deleteTimeEntry);
router.patch('/:taskId/estimate', updateEstimate);

// Task dependencies
router.post('/:taskId/dependencies', addDependency);
router.delete('/:taskId/dependencies/:blockerId', removeDependency);

export default router;
