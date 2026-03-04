import { Request, Response } from 'express';
import { Notification } from '../models/Notification.model';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { isRead, page = '1', limit = '20' } = req.query as Record<string, string>;
  const userId = req.user!._id;

  const filter: Record<string, unknown> = { recipient: userId };
  if (isRead === 'true') filter.isRead = true;
  if (isRead === 'false') filter.isRead = false;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('actor', 'name avatar')
      .populate('task', 'title')
      .populate('team', 'name'),
    Notification.countDocuments(filter),
  ]);

  sendSuccess(res, { notifications, total });
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await Notification.countDocuments({
    recipient: req.user!._id,
    isRead: false,
  });
  sendSuccess(res, { count });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user!._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) throw new ApiError(404, 'Notification not found.');
  sendSuccess(res, { notification });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await Notification.updateMany(
    { recipient: req.user!._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  sendSuccess(res, null, 'All notifications marked as read.');
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    recipient: req.user!._id,
  });
  if (!notification) throw new ApiError(404, 'Notification not found.');
  sendSuccess(res, null, 'Notification deleted.');
});
