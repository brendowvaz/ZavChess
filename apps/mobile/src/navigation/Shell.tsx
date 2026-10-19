import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { useResource } from '../api/hooks';
import type { Dashboard } from '../api/types';
import { Button, Notice } from '../ui/components';
import { BrandMark, Icon, type IconName } from '../ui/Icon';
import { colors, s, serif } from '../ui/theme';
import { activeTab, type Tab, useNavigation } from './Navigation';

const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'openings', label: 'Aberturas', icon: 'opening' }, { id: 'lessons', label: 'Fundamentos', icon: 'book' },
  { id: 'endgames', label: 'Finais', icon: 'flag' }, { id: 'games', label: 'Partidas', icon: 'play' },
  { id: 'puzzles', label: 'Puzzles', icon: 'puzzle' },
];
export function Shell({ children }: React.PropsWithChildren) {
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const insets = useSafeAreaInsets();
  const { route, navigate } = useNavigation();
  const { user, notice, retrySession, dismissNotice, restoring, revision } = useAuth();
  const dashboard = useResource<Dashboard>(user ? '/dashboard' : null, revision);
  const scroll = useRef<ScrollView>(null);
  const selected = activeTab(route);
  const immersive = ['lesson', 'puzzle', 'opening', 'endgame'].includes(route.screen);
  const screenLabel = selected === 'settings' ? 'Configurações' : selected === 'home' ? 'Meu progresso' : tabs.find(tab => tab.id === selected)?.label ?? 'Aprender';
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [route]);
  useEffect(() => {
    if (Platform.OS === 'web') { document.documentElement.lang = 'pt-BR'; document.title = `${screenLabel} · Zav Chess`; }
  }, [screenLabel]);
  const nav = (bottom: boolean) => tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label}
    accessibilityState={{ selected: selected === tab.id }} onPress={() => navigate({ screen: tab.id })}
    style={({ pressed }) => [{ flex: bottom ? 1 : undefined, minWidth: 0, minHeight: bottom ? 57 : 48,
      flexDirection: bottom ? 'column' : 'row', gap: bottom ? 4 : 14, alignItems: 'center', justifyContent: bottom ? 'center' : 'flex-start',
      borderRadius: bottom ? 10 : 12, paddingHorizontal: bottom ? 0 : 15,
      backgroundColor: selected === tab.id ? colors.pale : 'transparent', opacity: pressed ? 0.65 : 1 }]}>
    <Icon name={tab.icon} size={bottom ? 21 : 22} color={selected === tab.id ? colors.forest : colors.muted} />
    <Text numberOfLines={1} style={{ fontSize: bottom ? 9 : 14, fontWeight: selected === tab.id ? '700' : '500', color: selected === tab.id ? colors.forest : colors.muted }}>{tab.label}</Text>
    {!bottom && selected === tab.id ? <View style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: 3, backgroundColor: colors.forest }} /> : null}
  </Pressable>);
  if (immersive) return <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.background, paddingTop: insets.top }}>{notice ? <View style={{ padding: 8 }}><Notice>{notice}</Notice></View> : null}{children}</View>;
  return <View style={{ flex: 1, width: '100%', maxWidth: '100%', overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.background, paddingTop: insets.top }}>
    {wide ? <View style={{ width: 224, borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: colors.surface, padding: 24, paddingTop: 35, gap: 36 }}>
      <View style={s.row}><BrandMark /><View><Text style={{ fontFamily: serif, fontSize: 25, color: colors.forest }}>zav chess</Text><Text style={[s.eyebrow, { fontSize: 8, letterSpacing: 2.1 }]}>Um lance à frente</Text></View></View>
      <View style={{ gap: 8 }}><Text style={[s.eyebrow, { paddingLeft: 15, marginBottom: 8, fontSize: 9 }]}>Seu espaço de xadrez</Text>{nav(false)}</View>
      <View style={{ marginTop: 'auto', gap: 20 }}><View style={{ borderRadius: 16, backgroundColor: colors.pale, padding: 18, gap: 10 }}>
        <Icon name="spark" /><Text style={s.h3}>Cada lance ensina.</Text><Text style={s.small}>Explore uma ideia. Pratique no tabuleiro. Encontre seu próximo passo.</Text></View>
        <Text style={[s.small, { fontSize: 10 }]}>FEITO PARA APRENDER, LANCE A LANCE.</Text></View>
    </View> : null}
    <View style={{ flex: 1, flexBasis: 0, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <View style={{ width: '100%', minWidth: 0, minHeight: wide ? 60 : 58, paddingHorizontal: wide ? 30 : 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
        {wide ? <View style={s.row}><Text style={s.small}>Seu aprendizado</Text><Icon name="chevron" size={13} color={colors.muted} /><Text style={[s.small, { color: colors.ink }]}>{screenLabel}</Text></View>
          : <Pressable accessibilityRole="button" accessibilityLabel="Abrir meu progresso" onPress={() => navigate({ screen: 'home' })} style={({ pressed }) => [s.row, { gap: 9, flexShrink: 1, minWidth: 0, opacity: pressed ? 0.65 : 1 }]}><BrandMark size={31} /><Text numberOfLines={1} style={{ fontFamily: serif, fontSize: 23, color: colors.forest }}>zav chess</Text></Pressable>}
        <View style={[s.row, { gap: wide ? 18 : 10, flexShrink: 0 }]}>
        {user ? <Pressable accessibilityRole="button" accessibilityLabel={`Sequência atual: ${dashboard.data?.streak ?? 0} dias`} onPress={() => navigate({ screen: 'home' })}
          style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 5, opacity: pressed ? 0.65 : 1 })}>
          <Icon name="flame" size={19} color={colors.gold} /><Text style={[s.label, { color: colors.warning }]}>{dashboard.data?.streak ?? 0}</Text>
        </Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Configurações" accessibilityState={{ selected: selected === 'settings' }} onPress={() => navigate({ screen: 'settings' })}
          style={({ pressed }) => ({ minWidth: 44, minHeight: 44, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: selected === 'settings' ? colors.pale : 'transparent', opacity: pressed ? 0.65 : 1 })}>
          <Icon name="settings" />{wide ? <Text style={s.small}>Configurações</Text> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={user ? 'Abrir meu progresso' : 'Entrar ou criar uma conta'} onPress={() => navigate({ screen: user ? 'home' : 'auth' })}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, opacity: pressed ? 0.65 : 1 })}>
          {wide || !user ? <Text numberOfLines={1} style={[s.small, { fontWeight: '600', maxWidth: wide ? 200 : 100 }]}>{user ? user.name.split(' ')[0] : 'Entrar'}</Text> : null}
          <View style={{ backgroundColor: colors.pale, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}>
            {user ? <Text style={[s.label, { color: colors.forest }]}>{user.name.slice(0, 1).toLocaleUpperCase('pt-BR')}</Text> : <Icon name="user" size={18} />}</View>
        </Pressable>
        </View>
      </View>
      <ScrollView ref={scroll} style={{ flex: 1, width: '100%', minWidth: 0 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: wide ? 38 : 20, paddingBottom: 32, alignItems: 'center' }}>
        <View style={{ maxWidth: 1200, alignSelf: 'stretch', minWidth: 0, gap: 20 }}>
          {notice ? <Notice action={<View style={s.wrap}><Button label="Tentar restaurar sessão" variant="secondary" compact onPress={retrySession} busy={restoring} /><Button label="Fechar aviso" variant="ghost" compact onPress={dismissNotice} /></View>}>{notice}</Notice> : null}
          {children}
          <View style={{ marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderColor: colors.line }}><Text style={[s.small, { fontSize: 11, textAlign: 'center' }]}>Zav Chess · Aprender é o melhor próximo lance.</Text></View>
        </View>
      </ScrollView>
      {!wide ? <View accessibilityRole="tablist" style={{ width: '100%', minWidth: 0, overflow: 'hidden', flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 5, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) }}>{nav(true)}</View> : null}
    </View>
  </View>;
}
