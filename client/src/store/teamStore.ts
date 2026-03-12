import { create } from 'zustand';
import { Team } from '../types';
import { teamService } from '../services/teamService';

interface TeamStore {
  teams: Team[];
  activeTeam: Team | null;
  isLoading: boolean;
  fetchTeams: () => Promise<void>;
  setActiveTeam: (team: Team) => void;
  addTeam: (team: Team) => void;
  updateTeam: (teamId: string, data: Partial<Team>) => void;
  updateMemberLastSeen: (userId: string, lastSeenAt: string) => void;
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  teams: [],
  activeTeam: null,
  isLoading: false,

  fetchTeams: async () => {
    set({ isLoading: true });
    try {
      const teams = await teamService.getMyTeams();
      const activeTeam = get().activeTeam;
      set({
        teams,
        isLoading: false,
        activeTeam: activeTeam
          ? teams.find((t) => t._id === activeTeam._id) || teams[0] || null
          : teams[0] || null,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setActiveTeam: (team) => {
    set({ activeTeam: team });
    localStorage.setItem('activeTeamId', team._id);
  },

  addTeam: (team) => {
    set((state) => ({
      teams: [...state.teams, team],
      activeTeam: state.activeTeam || team,
    }));
  },

  updateTeam: (teamId, data) => {
    set((state) => ({
      teams: state.teams.map((t) => (t._id === teamId ? { ...t, ...data } : t)),
      activeTeam: state.activeTeam?._id === teamId ? { ...state.activeTeam, ...data } : state.activeTeam,
    }));
  },

  updateMemberLastSeen: (userId, lastSeenAt) => {
    const patch = (members: Team['members']) =>
      members.map((m) =>
        m.user._id === userId ? { ...m, user: { ...m.user, lastSeenAt } } : m
      );
    set((state) => ({
      teams: state.teams.map((t) => ({ ...t, members: patch(t.members) })),
      activeTeam: state.activeTeam
        ? { ...state.activeTeam, members: patch(state.activeTeam.members) }
        : null,
    }));
  },
}));
