import { create } from 'zustand';
import { Task, TaskStatus, TASK_STATUSES } from '../types';
import { taskService } from '../services/taskService';

interface TaskStore {
  tasks: Record<string, Task>;
  columns: Record<TaskStatus, string[]>;
  isLoading: boolean;
  activeTeamId: string | null;

  fetchTasks: (teamId: string) => Promise<void>;
  createTask: (data: Partial<Task> & { teamId: string }) => Promise<Task>;
  updateTask: (taskId: string, changes: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  moveTask: (taskId: string, newStatus: TaskStatus, newPosition: number) => void;
  rollbackMove: (taskId: string, prevStatus: TaskStatus, prevPosition: number) => void;
  applySocketTask: (task: Task) => void;
  applySocketUpdate: (taskId: string, changes: Partial<Task>) => void;
  applySocketDelete: (taskId: string) => void;
  setActiveTeam: (teamId: string) => void;
}

const buildColumns = (tasks: Task[]): Record<TaskStatus, string[]> => {
  const cols: Record<TaskStatus, string[]> = {
    todo: [], in_progress: [], review: [], done: [],
  };
  const sorted = [...tasks].sort((a, b) => a.position - b.position);
  for (const task of sorted) {
    if (!task.isArchived && cols[task.status] !== undefined) {
      cols[task.status].push(task._id);
    }
  }
  return cols;
};

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: {},
  columns: { todo: [], in_progress: [], review: [], done: [] },
  isLoading: false,
  activeTeamId: null,

  setActiveTeam: (teamId) => set({ activeTeamId: teamId }),

  fetchTasks: async (teamId) => {
    set({ isLoading: true, activeTeamId: teamId });
    try {
      const { tasks } = await taskService.getTasks({ teamId, limit: '200' });
      const taskMap = Object.fromEntries(tasks.map((t) => [t._id, t]));
      set({ tasks: taskMap, columns: buildColumns(tasks), isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createTask: async (data) => {
    const task = await taskService.createTask(data);
    set((state) => {
      // Always update task map with full API response (more complete than socket payload)
      const tasks = { ...state.tasks, [task._id]: task };
      const columns = { ...state.columns };
      // Guard: socket event may have already inserted the ID before HTTP response arrived
      if (!columns[task.status].includes(task._id)) {
        columns[task.status] = [...columns[task.status], task._id];
      }
      return { tasks, columns };
    });
    return task;
  },

  updateTask: async (taskId, changes) => {
    const task = await taskService.updateTask(taskId, changes);
    set((state) => {
      const prev = state.tasks[taskId];
      const tasks = { ...state.tasks, [taskId]: task };
      let columns = { ...state.columns };

      if (prev && prev.status !== task.status) {
        columns[prev.status] = columns[prev.status].filter((id) => id !== taskId);
        columns[task.status] = [...columns[task.status], taskId];
      }

      return { tasks, columns };
    });
  },

  deleteTask: async (taskId) => {
    const task = get().tasks[taskId];
    await taskService.deleteTask(taskId);
    set((state) => {
      const tasks = { ...state.tasks };
      delete tasks[taskId];
      const columns = { ...state.columns };
      if (task) columns[task.status] = columns[task.status].filter((id) => id !== taskId);
      return { tasks, columns };
    });
  },

  moveTask: (taskId, newStatus, newPosition) => {
    set((state) => {
      const task = state.tasks[taskId];
      if (!task) return state;

      const prevStatus = task.status;
      const tasks = { ...state.tasks, [taskId]: { ...task, status: newStatus, position: newPosition } };
      const columns = { ...state.columns };

      if (prevStatus !== newStatus) {
        columns[prevStatus] = columns[prevStatus].filter((id) => id !== taskId);
        columns[newStatus] = [...columns[newStatus], taskId].sort(
          (a, b) => (tasks[a]?.position || 0) - (tasks[b]?.position || 0)
        );
      } else {
        columns[newStatus] = [...columns[newStatus]].sort(
          (a, b) => (tasks[a]?.position || 0) - (tasks[b]?.position || 0)
        );
      }

      return { tasks, columns };
    });
  },

  rollbackMove: (taskId, prevStatus, prevPosition) => {
    set((state) => {
      const task = state.tasks[taskId];
      if (!task) return state;
      const curStatus = task.status;
      const tasks = { ...state.tasks, [taskId]: { ...task, status: prevStatus, position: prevPosition } };
      const columns = { ...state.columns };
      columns[curStatus] = columns[curStatus].filter((id) => id !== taskId);
      if (!columns[prevStatus].includes(taskId)) {
        columns[prevStatus] = [...columns[prevStatus], taskId].sort(
          (a, b) => (tasks[a]?.position || 0) - (tasks[b]?.position || 0)
        );
      }
      return { tasks, columns };
    });
  },

  applySocketTask: (task) => {
    set((state) => {
      if (state.tasks[task._id]) return state; // Already have it
      const tasks = { ...state.tasks, [task._id]: task };
      const columns = { ...state.columns };
      columns[task.status] = [...columns[task.status], task._id];
      return { tasks, columns };
    });
  },

  applySocketUpdate: (taskId, changes) => {
    set((state) => {
      const task = state.tasks[taskId];
      if (!task) return state;
      const updated = { ...task, ...changes } as Task;
      const tasks = { ...state.tasks, [taskId]: updated };
      let columns = { ...state.columns };

      if (changes.status && changes.status !== task.status) {
        columns[task.status] = columns[task.status].filter((id) => id !== taskId);
        columns[changes.status as TaskStatus] = [...columns[changes.status as TaskStatus], taskId];
      }

      return { tasks, columns };
    });
  },

  applySocketDelete: (taskId) => {
    set((state) => {
      const task = state.tasks[taskId];
      if (!task) return state;
      const tasks = { ...state.tasks };
      delete tasks[taskId];
      const columns = { ...state.columns };
      TASK_STATUSES.forEach(({ id }) => {
        columns[id] = columns[id].filter((id_) => id_ !== taskId);
      });
      return { tasks, columns };
    });
  },
}));
