import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Loading } from '../ui/components';
import { defaultAppearance, parseAppearance, type Appearance } from './themes';

const KEY = 'zav.appearance.v1';
type AppearanceContext = {
  appearance: Appearance;
  updateAppearance: (patch: Partial<Appearance>) => void;
  saveState: 'saved' | 'saving' | 'error';
  retrySave: () => void;
};
const Context = createContext<AppearanceContext | null>(null);
export function AppearanceProvider({ children }: React.PropsWithChildren) {
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<AppearanceContext['saveState']>('saved');
  const current = useRef(appearance);
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const raw = Platform.OS === 'web' ? globalThis.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
        if (mounted) { current.current = parseAppearance(raw); setAppearance(current.current); }
      } catch { if (mounted) setSaveState('error'); }
      finally { if (mounted) setReady(true); }
    };
    void restore();
    return () => { mounted = false; };
  }, []);
  const persist = (value: Appearance) => {
    const version = ++revision.current;
    setSaveState('saving');
    // Serialize writes so an earlier choice cannot overwrite a more recent one.
    queue.current = queue.current.then(async () => {
      try {
        const raw = JSON.stringify(value);
        if (Platform.OS === 'web') globalThis.localStorage.setItem(KEY, raw);
        else await SecureStore.setItemAsync(KEY, raw);
        if (version === revision.current) setSaveState('saved');
      } catch { if (version === revision.current) setSaveState('error'); }
    });
  };
  const updateAppearance = (patch: Partial<Appearance>) => {
    current.current = { ...current.current, ...patch };
    setAppearance(current.current);
    persist(current.current);
  };
  return <Context.Provider value={{ appearance, updateAppearance, saveState, retrySave: () => persist(current.current) }}>
    {ready ? children : <Loading label="Preparando seu tabuleiro…" />}
  </Context.Provider>;
}
export function useAppearance() {
  const context = useContext(Context);
  if (!context) throw new Error('AppearanceProvider ausente.');
  return context;
}
