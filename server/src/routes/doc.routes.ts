import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { listDocs, searchDocs, getDoc, createDoc, updateDoc, deleteDoc, enableDocShare, disableDocShare } from '../controllers/doc.controller';

const router = Router();

router.use(protect);

router.get('/', listDocs);
router.get('/search', searchDocs);   // before /:docId
router.post('/', createDoc);
router.get('/:docId', getDoc);
router.patch('/:docId', updateDoc);
router.delete('/:docId', deleteDoc);
router.post('/:docId/share', enableDocShare);
router.delete('/:docId/share', disableDocShare);

export default router;
