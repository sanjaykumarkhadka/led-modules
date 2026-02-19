import { useCallback } from 'react';

const DEV = typeof import.meta !== 'undefined' ? Boolean(import.meta.env.DEV) : false;

export function useInteractionTelemetry(channel: string) {
  return useCallback((event: string, payload?: Record<string, unknown>) => {
    if (!DEV) return;
    // Keep telemetry intentionally lightweight and dev-only.
    console.debug(`[telemetry:${channel}] ${event}`, payload ?? {});
  }, [channel]);
}
