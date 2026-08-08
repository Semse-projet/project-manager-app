import { create } from 'zustand';

type Role = 'professional' | 'client';

interface RoleStore {
  role: Role;
  setRole: (role: Role) => void;
  toggleRole: () => void;
}

export const useRoleStore = create<RoleStore>((set) => ({
  role: 'client',
  setRole: (role) => set({ role }),
  toggleRole: () => set((state) => ({ role: state.role === 'professional' ? 'client' : 'professional' })),
}));
