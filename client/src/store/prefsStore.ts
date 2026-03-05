import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PrefsState {
  soundEnabled: boolean;
  notifyTaskAssigned: boolean;
  notifyTaskUpdated: boolean;
  notifyTaskCompleted: boolean;
  notifyTeamEvents: boolean;
  setSoundEnabled: (v: boolean) => void;
  setNotifyPref: (key: keyof Omit<PrefsState, 'setSoundEnabled' | 'setNotifyPref'>, v: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      notifyTaskAssigned: true,
      notifyTaskUpdated: true,
      notifyTaskCompleted: true,
      notifyTeamEvents: true,
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setNotifyPref: (key, v) => set({ [key]: v }),
    }),
    { name: 'taskflow-prefs' }
  )
);
