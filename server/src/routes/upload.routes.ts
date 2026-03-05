import { Router } from 'express';
import {
  presignUpload,
  confirmUpload,
  getAttachments,
  deleteAttachment,
} from '../controllers/upload.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.post('/presign', presignUpload);        // Step 1 — get a pre-signed PUT URL
router.post('/confirm', confirmUpload);         // Step 2 — save metadata after upload
router.get('/:taskId', getAttachments);         // List attachments for a task
router.delete('/:attachmentId', deleteAttachment); // Delete an attachment

export default router;
