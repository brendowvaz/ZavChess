import { Platform, StyleSheet } from 'react-native';

export const colors = {
  background: '#0E1012', surface: '#191C1F', forest: '#70B69A', forestDark: '#3F8069',
  ink: '#F5F3EB', muted: '#A9B0AC', line: '#30363A', pale: '#20352E', sage: '#5F8978',
  gold: '#F2A43B', warning: '#F6B955', warningBg: '#3A2B16', error: '#FF8C82', errorBg: '#3C211F',
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
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 15,
    paddingVertical: 13, color: colors.ink, fontSize: 15, minHeight: 48 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: 26 },
  separator: { height: 1, backgroundColor: colors.line },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 20, color: colors.muted },
});
