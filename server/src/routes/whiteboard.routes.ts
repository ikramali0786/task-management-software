import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  getBoards, createBoard, renameBoard, deleteBoard,
  getWhiteboard, saveWhiteboard, presignBoardImage,
  listSnapshots, createSnapshot, restoreSnapshot,
} from '../controllers/whiteboard.controller';

const router = Router();

router.use(protect);

// Board management
router.get('/boards', getBoards);
router.post('/boards', createBoard);
router.patch('/boards/:boardId', renameBoard);
router.delete('/boards/:boardId', deleteBoard);

// Version history
router.get('/boards/:boardId/snapshots', listSnapshots);
router.post('/boards/:boardId/snapshots', createSnapshot);
router.post('/boards/:boardId/snapshots/:snapshotId/restore', restoreSnapshot);

// Board contents
router.get('/', getWhiteboard);
router.put('/', saveWhiteboard);
router.post('/image', presignBoardImage);

export default router;
