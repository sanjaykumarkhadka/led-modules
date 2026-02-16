import { http } from '../lib/http';

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  role: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  return http<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: payload,
  });
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return http<AuthResponse>('/auth/login', {
    method: 'POST',
    body: payload,
  });
}

export async function refresh(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  return http<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export async function getMe(accessToken: string): Promise<AuthUser> {
  return http<AuthUser>('/users/me', {
    method: 'GET',
    accessToken,
  });
}

