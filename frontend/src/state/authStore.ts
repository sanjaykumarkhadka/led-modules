import { create } from 'zustand';
import type { AuthUser, AuthResponse } from '../api/auth';
import { signup as apiSignup, login as apiLogin, refresh as apiRefresh, getMe } from '../api/auth';

type AuthStatus = 'idle' | 'initializing' | 'authenticating' | 'authenticated' | 'error';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  status: AuthStatus;
  errorMessage: string | null;

  signup: (payload: { email: string; password: string; displayName?: string }) => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  bootstrap: () => Promise<void>;
  refreshTokens: () => Promise<void>;
}

const ACCESS_TOKEN_KEY = 'auth_accessToken';
const REFRESH_TOKEN_KEY = 'auth_refreshToken';

function persistTokens(response: AuthResponse) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
}

function clearPersistedTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  status: 'idle',
  errorMessage: null,

  async signup(payload) {
    set({ status: 'authenticating', errorMessage: null });
    try {
      const res = await apiSignup(payload);
      persistTokens(res);
      set({
        user: res.user,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        status: 'authenticated',
        errorMessage: null,
      });
    } catch (err: any) {
      set({
        status: 'error',
        errorMessage: err?.message ?? 'Failed to sign up',
      });
    }
  },

  async login(payload) {
    set({ status: 'authenticating', errorMessage: null });
    try {
      const res = await apiLogin(payload);
      persistTokens(res);
      set({
        user: res.user,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        status: 'authenticated',
        errorMessage: null,
      });
    } catch (err: any) {
      set({
        status: 'error',
        errorMessage: err?.message ?? 'Failed to log in',
      });
    }
  },

  logout() {
    clearPersistedTokens();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      status: 'idle',
      errorMessage: null,
    });
  },

  async bootstrap() {
    if (get().status !== 'idle') return;
    set({ status: 'initializing', errorMessage: null });
    try {
      const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!accessToken || !refreshToken) {
        set({ status: 'idle' });
        return;
      }

      // Try to fetch current user with stored access token
      const user = await getMe(accessToken);
      set({
        user,
        accessToken,
        refreshToken,
        status: 'authenticated',
        errorMessage: null,
      });
    } catch {
      // If access token is invalid, try refresh once
      try {
        const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          clearPersistedTokens();
          set({ status: 'idle', user: null, accessToken: null, refreshToken: null });
          return;
        }
        const tokens = await apiRefresh(refreshToken);
        window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
        window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
        const user = await getMe(tokens.accessToken);
        set({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          status: 'authenticated',
          errorMessage: null,
        });
      } catch {
        clearPersistedTokens();
        set({
          status: 'idle',
          user: null,
          accessToken: null,
          refreshToken: null,
        });
      }
    }
  },

  async refreshTokens() {
    const refreshToken = get().refreshToken ?? window.localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return;
    try {
      const tokens = await apiRefresh(refreshToken);
      window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch {
      get().logout();
    }
  },
}));

