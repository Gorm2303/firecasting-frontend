declare global {
  interface Window {
    __ENV?: Record<string, string | undefined>;
  }
}

export function getApiBaseUrl(): string {
  const runtime = typeof window !== 'undefined' ? window.__ENV?.VITE_API_BASE_URL : undefined;
  const baked = import.meta.env.VITE_API_BASE_URL;
  return String(runtime ?? baked ?? '').replace(/\/+$/, '');
}
