import { create } from 'zustand';

export interface TaskItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

interface TasksState {
  tasks: TaskItem[];
  sessionId: string | null;
  setTasks: (tasks: TaskItem[]) => void;
  setSessionId: (id: string | null) => void;
  clearTasks: () => void;
}

export const useTasksStore = create<TasksState>((set) => ({
  tasks: [],
  sessionId: null,
  setTasks: (tasks) => set({ tasks }),
  setSessionId: (id) => set({ sessionId: id }),
  clearTasks: () => set({ tasks: [], sessionId: null }),
}));
