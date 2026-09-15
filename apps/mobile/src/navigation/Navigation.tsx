import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

export type Tab = 'home' | 'lessons' | 'openings' | 'puzzles' | 'endgames' | 'analysis';
export type Route = { screen: Tab | 'auth' | 'settings' | 'report' } | { screen: 'lesson' | 'puzzle' | 'opening-family' | 'endgame'; id: string } | { screen: 'opening'; id: string; studySide?: 'w' | 'b' };
const screenNames = new Set(['home', 'lessons', 'openings', 'puzzles', 'endgames', 'analysis', 'auth', 'settings', 'report', 'lesson', 'puzzle', 'opening', 'opening-family', 'endgame']);
function routeHash(route: Route) {
  return `#/${route.screen}${'id' in route ? `/${encodeURIComponent(route.id)}` : ''}${route.screen === 'opening' && route.studySide ? `?side=${route.studySide}` : ''}`;
}
function readHash(): Route {
  if (Platform.OS !== 'web') return { screen: 'home' };
  const [path, query] = globalThis.location.hash.replace(/^#\/?/, '').split('?');
  const [screen, id] = path!.split('/');
  if (!screen || !screenNames.has(screen)) return { screen: 'home' };
  if (screen === 'lesson' || screen === 'puzzle' || screen === 'opening' || screen === 'opening-family' || screen === 'endgame') {
    try {
      if (!id) return { screen: 'home' };
      const side = new URLSearchParams(query).get('side');
      if (screen === 'opening') return { screen, id: decodeURIComponent(id), ...(side === 'w' || side === 'b' ? { studySide: side } : {}) };
      return { screen, id: decodeURIComponent(id) };
    } catch { return { screen: 'home' }; }
  }
  return { screen: screen as Tab | 'auth' | 'settings' | 'report' };
}
export function activeTab(route: Route): Tab | 'settings' {
  if (route.screen === 'lesson') return 'lessons';
  if (route.screen === 'puzzle') return 'puzzles';
  if (route.screen === 'report') return 'home';
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
      globalThis.history.pushState(null, '', routeHash(next));
    }
    setRoute(next);
  }, [route]);
  const replace = useCallback((next: Route) => {
    if (JSON.stringify(next) === JSON.stringify(route)) return;
    if (Platform.OS === 'web') {
      globalThis.history.replaceState(null, '', routeHash(next));
    }
    setRoute(next);
  }, [route]);
  const back = useCallback(() => {
    if (Platform.OS === 'web' && stack.current.length) { globalThis.history.back(); return; }
    const next = stack.current.pop() ?? { screen: route.screen === 'settings' ? 'home' as const : activeTab(route) };
    setRoute(next);
    if (Platform.OS === 'web') globalThis.history.replaceState(null, '', routeHash(next));
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
      if (stack.current.length || ['lesson', 'puzzle', 'opening', 'opening-family', 'endgame', 'auth', 'settings', 'report'].includes(route.screen)) { back(); return true; }
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
