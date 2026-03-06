import { Router } from 'express';
import authRoutes from './auth.routes';
import teamRoutes from './team.routes';
import taskRoutes from './task.routes';
import notificationRoutes from './notification.routes';
import commentRoutes from './comment.routes';
import reactionRoutes from './reaction.routes';
import discussionRoutes from './discussion.routes';
import uploadRoutes from './upload.routes';
import apiKeyRoutes from './apiKey.routes';
import chatbotRoutes from './chatbot.routes';
import chatSessionRoutes from './chatSession.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/teams', teamRoutes);
router.use('/tasks', taskRoutes);
router.use('/notifications', notificationRoutes);
router.use('/comments', commentRoutes);
router.use('/reactions', reactionRoutes);
router.use('/discussions', discussionRoutes);
router.use('/uploads', uploadRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/chatbots', chatbotRoutes);
router.use('/chat-sessions', chatSessionRoutes);

export default router;
