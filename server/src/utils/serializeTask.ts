/**
 * Stable, public-facing JSON shape for a Task — used by the v1 REST API
 * responses and by outbound webhook payloads so integrators see one consistent
 * schema. Tolerates both populated (object) and bare (ObjectId) refs.
 */

const refId = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'object' && v._id) return v._id.toString();
  return v.toString();
};

const person = (v: any): { id: string; name?: string; avatar?: string } | string | null => {
  if (!v) return null;
  if (typeof v === 'object' && v._id) {
    return { id: v._id.toString(), name: v.name, avatar: v.avatar };
  }
  return v.toString();
};

export const serializeTask = (task: any) => {
  const t = typeof task?.toObject === 'function' ? task.toObject() : task;
  return {
    id: t._id?.toString(),
    identifier: t.identifier ?? null,
    title: t.title,
    description: t.description ?? '',
    team: refId(t.team),
    status: t.status,
    priority: t.priority,
    labels: (t.labels || []).map((l: any) => ({ name: l.name, color: l.color })),
    assignees: (t.assignees || []).map(person),
    createdBy: person(t.createdBy),
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : null,
    estimatedMinutes: t.estimatedMinutes ?? null,
    subtasks: (t.subtasks || []).map((s: any) => ({
      id: s._id?.toString(),
      title: s.title,
      completed: s.completed,
    })),
    recurrence: t.recurrence
      ? {
          frequency: t.recurrence.frequency,
          interval: t.recurrence.interval,
          endDate: t.recurrence.endDate ? new Date(t.recurrence.endDate).toISOString() : null,
        }
      : null,
    isArchived: Boolean(t.isArchived),
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
    updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
  };
};
