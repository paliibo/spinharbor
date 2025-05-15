'use client';
import type { AuthUserDto } from '@spinharbor/contracts';
import { create } from 'zustand';

interface AuthState {
  user: AuthUserDto | null;
  status: 'idle' | 'loading' | 'ready';
  setUser: (u: AuthUserDto | null) => void;
  setStatus: (s: AuthState['status']) => void;
}

/** Client-side mirror of the authenticated user; the API remains the authority. */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  setUser: (user) => set({ user, status: 'ready' }),
  setStatus: (status) => set({ status }),
}));

export const STAFF_ROLES = new Set(['SUPPORT', 'OPERATOR', 'ADMIN']);
export const isStaff = (u: AuthUserDto | null) => !!u && STAFF_ROLES.has(u.role);
