import { Platform } from 'react-native';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3001/api' : 'http://localhost:3001/api')).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message: string, public readonly status = 0) { super(message); this.name = 'ApiError'; }
}

let token: string | null = null;
const expiredListeners = new Set<() => void>();
export function setApiToken(value: string | null) { token = value; }
export function onSessionExpired(listener: () => void) {
  expiredListeners.add(listener);
  return () => { expiredListeners.delete(listener); };
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
}
export function isAbort(error: unknown) { return error instanceof Error && error.name === 'AbortError'; }

export async function request<T>(path: string, options: {
  method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal; timeout?: number;
} = {}): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const requestToken = token;
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeout ?? 25000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET', signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}) },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    const raw = await response.text();
    if (controller.signal.aborted) throw new DOMException('Requisição cancelada.', 'AbortError');
    let payload: unknown;
    try { payload = raw ? JSON.parse(raw) : undefined; } catch { payload = undefined; }
    if (!response.ok) {
      if (response.status === 401 && requestToken && requestToken === token && !path.startsWith('/auth/')) {
        expiredListeners.forEach(listener => listener());
      }
      const message = payload && typeof payload === 'object' && 'message' in payload ? payload.message : undefined;
      const detail = Array.isArray(message) ? message.join('\n') : typeof message === 'string' ? message : undefined;
      const fallback = response.status === 503 ? 'Serviço temporariamente indisponível. Tente novamente em instantes.'
        : response.status === 401 ? 'Sua sessão expirou. Entre novamente.'
        : response.status === 429 ? 'Muitas solicitações. Aguarde um pouco e tente novamente.'
        : `Não foi possível concluir a solicitação (${response.status}).`;
      throw new ApiError(detail || fallback, response.status);
    }
    if (payload === undefined && response.status !== 204) throw new ApiError('A API retornou uma resposta inválida.', response.status);
    return payload as T;
  } catch (error) {
    if (timedOut) throw new ApiError('A resposta demorou mais que o esperado. Verifique sua conexão e tente novamente.');
    if (isAbort(error) || error instanceof ApiError) throw error;
    throw new ApiError(`Não foi possível conectar à API (${API_URL}). Verifique sua rede e se o servidor está em execução.`);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export const api = {
  get: <T,>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T,>(path: string, body: unknown, signal?: AbortSignal) => request<T>(path, { method: 'POST', body, signal, timeout: path === '/analysis' ? 60000 : 25000 }),
};
