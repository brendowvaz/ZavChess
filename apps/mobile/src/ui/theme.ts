import { Platform, StyleSheet } from 'react-native';

export const colors = {
  background: '#F6F4ED', surface: '#FFFEFA', forest: '#214B3D', forestDark: '#173B30',
  ink: '#223C32', muted: '#67746A', line: '#DFE3D8', pale: '#EAF0E5', sage: '#A6B58E',
  gold: '#DAB875', warning: '#805710', warningBg: '#FCF0D7', error: '#A03731', errorBg: '#FBEAE6',
  boardLight: '#E9E9D5', boardDark: '#819878', selected: '#E8C16E', white: '#FFFFFF',
};
export const serif = Platform.select({ web: 'Georgia, Times New Roman, serif', ios: 'Georgia', default: 'serif' });
export const s = StyleSheet.create({
  page: { gap: 24 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stack: { gap: 16 }, grow: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 22, gap: 14 },
  eyebrow: { fontSize: 11, letterSpacing: 2, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  title: { fontFamily: serif, fontSize: 34, lineHeight: 41, color: colors.ink },
  h2: { fontSize: 21, lineHeight: 28, color: colors.ink, fontWeight: '600' },
  h3: { fontSize: 17, lineHeight: 24, color: colors.ink, fontWeight: '600' },
  body: { color: colors.ink, fontSize: 15, lineHeight: 24 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  input: { borderWidth: 1, borderColor: '#CED7CA', backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 15,
    paddingVertical: 13, color: colors.ink, fontSize: 15, minHeight: 48 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: 26 },
  separator: { height: 1, backgroundColor: colors.line },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 20, color: colors.muted },
});
