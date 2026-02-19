import { API_BASE_URL } from './config';

export interface HttpError extends Error {
  status: number;
  details?: unknown;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  accessToken?: string | null;
  signal?: AbortSignal;
}

function emitAuthUnauthorized(status: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('auth:unauthorized', {
      detail: { status },
    }),
  );
}

function getErrorMessage(data: unknown, status: number) {
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return `Request failed with status ${status}`;
}

export async function http<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body:
      options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      emitAuthUnauthorized(response.status);
    }
    const error: HttpError = Object.assign(
      new Error(getErrorMessage(data, response.status)),
      {
        status: response.status,
        details: data,
      },
    );
    throw error;
  }

  return data as TResponse;
}
