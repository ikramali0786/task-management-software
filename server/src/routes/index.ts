import { Router } from 'express';
import authRoutes from './auth.routes';
import teamRoutes from './team.routes';
import taskRoutes from './task.routes';
import notificationRoutes from './notification.routes';
import commentRoutes from './comment.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/teams', teamRoutes);
router.use('/tasks', taskRoutes);
router.use('/notifications', notificationRoutes);
router.use('/comments', commentRoutes);

export default router;
