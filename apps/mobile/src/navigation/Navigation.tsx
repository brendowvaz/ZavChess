import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

export type Tab = 'home' | 'lessons' | 'openings' | 'puzzles' | 'endgames' | 'analysis';
export type Route = { screen: Tab | 'auth' | 'settings' } | { screen: 'lesson' | 'opening' | 'opening-family' | 'endgame'; id: string };
const screenNames = new Set(['home', 'lessons', 'openings', 'puzzles', 'endgames', 'analysis', 'auth', 'settings', 'lesson', 'opening', 'opening-family', 'endgame']);
function readHash(): Route {
  if (Platform.OS !== 'web') return { screen: 'home' };
  const [screen, id] = globalThis.location.hash.replace(/^#\/?/, '').split('/');
  if (!screen || !screenNames.has(screen)) return { screen: 'home' };
  if (screen === 'lesson' || screen === 'opening' || screen === 'opening-family' || screen === 'endgame') {
    try { return id ? { screen, id: decodeURIComponent(id) } : { screen: 'home' }; } catch { return { screen: 'home' }; }
  }
  return { screen: screen as Tab | 'auth' | 'settings' };
}
export function activeTab(route: Route): Tab | 'settings' {
  if (route.screen === 'lesson') return 'lessons';
  if (route.screen === 'opening') return 'openings';
  if (route.screen === 'opening-family') return 'openings';
  if (route.screen === 'endgame') return 'endgames';
  if (route.screen === 'auth') return 'home';
  return route.screen;
}
type Navigation = { route: Route; navigate: (route: Route) => void; replace: (route: Route) => void; back: () => void };
const Context = createContext<Navigation | null>(null);
export function NavigationProvider({ children }: React.PropsWithChildren) {
  const [route, setRoute] = useState<Route>(readHash);
  const stack = useRef<Route[]>([]);
  const navigate = useCallback((next: Route) => {
    if (JSON.stringify(next) === JSON.stringify(route)) return;
    stack.current.push(route);
    if (Platform.OS === 'web') {
      globalThis.history.pushState(null, '', `#/${next.screen}${'id' in next ? `/${encodeURIComponent(next.id)}` : ''}`);
    }
    setRoute(next);
  }, [route]);
  const replace = useCallback((next: Route) => {
    if (JSON.stringify(next) === JSON.stringify(route)) return;
    if (Platform.OS === 'web') {
      globalThis.history.replaceState(null, '', `#/${next.screen}${'id' in next ? `/${encodeURIComponent(next.id)}` : ''}`);
    }
    setRoute(next);
  }, [route]);
  const back = useCallback(() => {
    if (Platform.OS === 'web' && stack.current.length) { globalThis.history.back(); return; }
    const next = stack.current.pop() ?? { screen: route.screen === 'settings' ? 'home' as const : activeTab(route) };
    setRoute(next);
    if (Platform.OS === 'web') globalThis.history.replaceState(null, '', `#/${next.screen}${'id' in next ? `/${encodeURIComponent(next.id)}` : ''}`);
  }, [route]);
  useEffect(() => {
    if (Platform.OS === 'web') {
      let lastHash = globalThis.location.hash;
      const sync = () => {
        if (lastHash === globalThis.location.hash) return;
        lastHash = globalThis.location.hash;
        stack.current.pop();
        setRoute(readHash());
      };
      globalThis.addEventListener('popstate', sync); globalThis.addEventListener('hashchange', sync);
      return () => { globalThis.removeEventListener('popstate', sync); globalThis.removeEventListener('hashchange', sync); };
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.current.length || ['lesson', 'opening', 'opening-family', 'endgame', 'auth', 'settings'].includes(route.screen)) { back(); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [back, route.screen]);
  return <Context.Provider value={{ route, navigate, replace, back }}>{children}</Context.Provider>;
}
export function useNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error('NavigationProvider ausente.');
  return value;
}
