import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, ApiError, errorMessage, isAbort, onSessionExpired, setApiToken } from '../api/client';
import type { Session, User } from '../api/types';
import { tokenStorage } from './storage';

type AuthValue = {
  user: User | null; restoring: boolean; notice: string | null; revision: number;
  authenticate: (mode: 'login' | 'register', fields: { name?: string; email: string; password: string }, signal: AbortSignal) => Promise<void>;
  logout: (signal: AbortSignal) => Promise<void>; refreshProgress: () => void; retrySession: () => void; dismissNotice: () => void;
};
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [restoreKey, setRestoreKey] = useState(0);
  const sessionVersion = useRef(0);
  const refreshProgress = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => onSessionExpired(() => {
    sessionVersion.current++; setApiToken(null); setUser(null); refreshProgress();
    setNotice('Sua sessão expirou. Entre novamente para continuar salvando seu progresso.');
    void tokenStorage.clear().catch(() => setNotice('Sessão expirada. Não foi possível limpar o armazenamento seguro.'));
  }), [refreshProgress]);
  useEffect(() => {
    const controller = new AbortController();
    const version = ++sessionVersion.current;
    const restore = async () => {
      setRestoring(true);
      try {
        const savedToken = await tokenStorage.read();
        if (controller.signal.aborted || version !== sessionVersion.current) return;
        if (savedToken) {
          setApiToken(savedToken);
          const savedUser = await api.get<User>('/auth/me', controller.signal);
          if (version === sessionVersion.current) { setUser(savedUser); setNotice(null); }
        }
      } catch (error) {
        if (controller.signal.aborted || isAbort(error) || version !== sessionVersion.current) return;
        setApiToken(null); setUser(null);
        if (error instanceof ApiError && error.status === 401) {
          await tokenStorage.clear().catch(() => undefined);
          setNotice('Sua sessão expirou. Entre novamente.');
        } else setNotice(`Não foi possível restaurar sua sessão. ${errorMessage(error)}`);
      } finally { if (!controller.signal.aborted && version === sessionVersion.current) setRestoring(false); }
    };
    void restore();
    return () => controller.abort();
  }, [restoreKey]);
  const authenticate: AuthValue['authenticate'] = async (mode, fields, signal) => {
    const session = await api.post<Session>(`/auth/${mode}`, fields, signal);
    try { await tokenStorage.write(session.token); }
    catch { throw new Error('Não foi possível salvar a sessão com segurança. Habilite o armazenamento deste aplicativo e tente novamente.'); }
    sessionVersion.current++; setApiToken(session.token); setUser(session.user); setNotice(null); setRestoring(false); refreshProgress();
  };
  const logout = async (signal: AbortSignal) => {
    await api.post('/auth/logout', {}, signal);
    sessionVersion.current++; setApiToken(null); setUser(null); refreshProgress();
    try { await tokenStorage.clear(); }
    catch { setNotice('Sessão revogada no servidor. Não foi possível limpar o armazenamento local.'); }
  };
  return <AuthContext.Provider value={{ user, restoring, notice, revision, authenticate, logout, refreshProgress,
    retrySession: () => setRestoreKey(n => n + 1), dismissNotice: () => setNotice(null) }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider ausente.');
  return auth;
}
