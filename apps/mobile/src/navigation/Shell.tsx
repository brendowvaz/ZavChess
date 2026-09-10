import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { Button, Notice } from '../ui/components';
import { BrandMark, Icon, type IconName } from '../ui/Icon';
import { colors, s, serif } from '../ui/theme';
import { activeTab, type Tab, useNavigation } from './Navigation';

const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Início', icon: 'home' }, { id: 'lessons', label: 'Aulas', icon: 'book' },
  { id: 'openings', label: 'Aberturas', icon: 'opening' }, { id: 'puzzles', label: 'Puzzles', icon: 'puzzle' },
  { id: 'endgames', label: 'Finais', icon: 'flag' }, { id: 'analysis', label: 'Jogar', icon: 'play' },
];
export function Shell({ children }: React.PropsWithChildren) {
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const insets = useSafeAreaInsets();
  const { route, navigate } = useNavigation();
  const { user, notice, retrySession, dismissNotice, restoring } = useAuth();
  const scroll = useRef<ScrollView>(null);
  const selected = activeTab(route);
  const screenLabel = selected === 'settings' ? 'Configurações' : tabs.find(tab => tab.id === selected)?.label ?? 'Aprender';
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [route]);
  useEffect(() => {
    if (Platform.OS === 'web') { document.documentElement.lang = 'pt-BR'; document.title = `${screenLabel} · Zav Chess`; }
  }, [screenLabel]);
  const nav = (bottom: boolean) => tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label}
    accessibilityState={{ selected: selected === tab.id }} onPress={() => navigate({ screen: tab.id })}
    style={({ pressed }) => [{ flex: bottom ? 1 : undefined, minHeight: bottom ? 57 : 48,
      flexDirection: bottom ? 'column' : 'row', gap: bottom ? 4 : 14, alignItems: 'center', justifyContent: bottom ? 'center' : 'flex-start',
      borderRadius: bottom ? 10 : 12, paddingHorizontal: bottom ? 0 : 15,
      backgroundColor: selected === tab.id ? colors.pale : 'transparent', opacity: pressed ? 0.65 : 1 }]}>
    <Icon name={tab.icon} size={bottom ? 21 : 22} color={selected === tab.id ? colors.forest : colors.muted} />
    <Text style={{ fontSize: bottom ? 10 : 14, fontWeight: selected === tab.id ? '700' : '500', color: selected === tab.id ? colors.forest : colors.muted }}>{tab.label}</Text>
    {!bottom && selected === tab.id ? <View style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: 3, backgroundColor: colors.forest }} /> : null}
  </Pressable>);
  return <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background, paddingTop: insets.top }}>
    {wide ? <View style={{ width: 224, borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: colors.surface, padding: 24, paddingTop: 35, gap: 36 }}>
      <View style={s.row}><BrandMark /><View><Text style={{ fontFamily: serif, fontSize: 25, color: colors.forest }}>zav chess</Text><Text style={[s.eyebrow, { fontSize: 8, letterSpacing: 2.1 }]}>Um lance à frente</Text></View></View>
      <View style={{ gap: 8 }}><Text style={[s.eyebrow, { paddingLeft: 15, marginBottom: 8, fontSize: 9 }]}>Seu espaço de xadrez</Text>{nav(false)}</View>
      <View style={{ marginTop: 'auto', gap: 20 }}><View style={{ borderRadius: 16, backgroundColor: colors.pale, padding: 18, gap: 10 }}>
        <Icon name="spark" /><Text style={s.h3}>Cada lance ensina.</Text><Text style={s.small}>Explore uma ideia. Pratique no tabuleiro. Encontre seu próximo passo.</Text></View>
        <Text style={[s.small, { fontSize: 10 }]}>FEITO PARA APRENDER, LANCE A LANCE.</Text></View>
    </View> : null}
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ minHeight: wide ? 82 : 65, paddingHorizontal: wide ? 38 : 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
        {wide ? <View style={s.row}><Text style={s.small}>Seu aprendizado</Text><Icon name="chevron" size={13} color={colors.muted} /><Text style={[s.small, { color: colors.ink }]}>{screenLabel}</Text></View>
          : <View style={[s.row, { gap: 9 }]}><BrandMark size={31} /><Text style={{ fontFamily: serif, fontSize: 23, color: colors.forest }}>zav chess</Text></View>}
        <View style={[s.row, { gap: wide ? 18 : 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Configurações" accessibilityState={{ selected: selected === 'settings' }} onPress={() => navigate({ screen: 'settings' })}
          style={({ pressed }) => ({ minWidth: 44, minHeight: 44, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: selected === 'settings' ? colors.pale : 'transparent', opacity: pressed ? 0.65 : 1 })}>
          <Icon name="settings" />{wide ? <Text style={s.small}>Configurações</Text> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={user ? 'Abrir minha conta' : 'Entrar ou criar uma conta'} onPress={() => navigate({ screen: 'auth' })}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, opacity: pressed ? 0.65 : 1 })}>
          <Text numberOfLines={1} style={[s.small, { fontWeight: '600', maxWidth: wide ? 200 : 100 }]}>{user ? user.name.split(' ')[0] : 'Entrar'}</Text>
          <View style={{ backgroundColor: colors.pale, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}>
            {user ? <Text style={[s.label, { color: colors.forest }]}>{user.name.slice(0, 1).toLocaleUpperCase('pt-BR')}</Text> : <Icon name="user" size={18} />}</View>
        </Pressable>
        </View>
      </View>
      <ScrollView ref={scroll} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: wide ? 38 : 20, paddingBottom: 32, alignItems: 'center' }}>
        <View style={{ maxWidth: 1200, width: '100%', gap: 20 }}>
          {notice ? <Notice action={<View style={s.wrap}><Button label="Tentar restaurar sessão" variant="secondary" compact onPress={retrySession} busy={restoring} /><Button label="Fechar aviso" variant="ghost" compact onPress={dismissNotice} /></View>}>{notice}</Notice> : null}
          {children}
          <View style={{ marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderColor: colors.line }}><Text style={[s.small, { fontSize: 11, textAlign: 'center' }]}>Zav Chess · Aprender é o melhor próximo lance.</Text></View>
        </View>
      </ScrollView>
      {!wide ? <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 5, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) }}>{nav(true)}</View> : null}
    </View>
  </View>;
}
