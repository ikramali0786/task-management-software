import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { listDocs, getDoc, createDoc, updateDoc, deleteDoc } from '../controllers/doc.controller';

const router = Router();

router.use(protect);

router.get('/', listDocs);
router.post('/', createDoc);
router.get('/:docId', getDoc);
router.patch('/:docId', updateDoc);
router.delete('/:docId', deleteDoc);

export default router;
