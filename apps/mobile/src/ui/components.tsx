import React from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, s } from './theme';
import { Icon, type IconName } from './Icon';

export function Button({ label, onPress, variant = 'primary', icon, disabled, busy, compact = false, style }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'light'; icon?: IconName;
  disabled?: boolean; busy?: boolean; compact?: boolean; style?: ViewStyle;
}) {
  const foreground = variant === 'primary' ? colors.white : colors.forest;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
    onPress={onPress} disabled={disabled || busy} style={({ pressed }) => [{ minHeight: compact ? 40 : 48, borderRadius: 12,
      paddingHorizontal: compact ? 13 : 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
      backgroundColor: variant === 'primary' ? colors.forest : variant === 'secondary' ? colors.pale : variant === 'light' ? '#F0EFDA' : 'transparent',
      opacity: disabled || busy ? 0.5 : pressed ? 0.76 : 1 }, style]}>
    {busy ? <ActivityIndicator size="small" color={foreground} /> : icon ? <Icon name={icon} size={18} color={foreground} /> : null}
    <Text style={{ color: foreground, fontWeight: '600', fontSize: compact ? 13 : 14 }}>{label}</Text>
  </Pressable>;
}
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : 'text'} accessibilityState={{ selected: !!selected }} disabled={!onPress}
    onPress={onPress} style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 10, minHeight: onPress ? 44 : undefined,
      justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: selected ? colors.forest : colors.line,
      backgroundColor: selected ? colors.forest : colors.surface, opacity: pressed ? 0.75 : 1 })}>
    <Text style={{ fontSize: 13, color: selected ? colors.white : colors.muted, fontWeight: selected ? '600' : '400' }}>{label}</Text>
  </Pressable>;
}
export function Badge({ children, tone = 'green' }: React.PropsWithChildren<{ tone?: 'green' | 'gold' | 'neutral' }>) {
  return <View style={{ alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: tone === 'gold' ? colors.warningBg : tone === 'neutral' ? '#EFEEE7' : colors.pale }}>
    <Text style={{ fontSize: 11, fontWeight: '600', color: tone === 'gold' ? colors.warning : colors.forest }}>{children}</Text>
  </View>;
}
export function Card({ children, style }: React.PropsWithChildren<{ style?: ViewStyle }>) { return <View style={[s.card, style]}>{children}</View>; }
export function Heading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <View style={[s.between, { alignItems: 'flex-start', flexWrap: 'wrap' }]}><View style={{ flexGrow: 1, flexShrink: 1, gap: 7 }}>
    {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}<Text accessibilityRole="header" style={s.title}>{title}</Text>
    {description ? <Text style={s.muted}>{description}</Text> : null}</View>{action}</View>;
}
export function Notice({ children, tone = 'info', action }: React.PropsWithChildren<{ tone?: 'info' | 'error' | 'success'; action?: React.ReactNode }>) {
  return <View accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite"
    style={{ padding: 16, borderRadius: 13, gap: 10, backgroundColor: tone === 'error' ? colors.errorBg : colors.pale }}>
    <Text style={[s.body, { fontSize: 14, color: tone === 'error' ? colors.error : colors.forest }]}>{children}</Text>{action}</View>;
}
export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ padding: 34, alignItems: 'center', gap: 14 }}>
    <ActivityIndicator color={colors.forest} /><Text style={s.muted}>{label}</Text></View>;
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <Notice tone="error" action={retry ? <Button label="Tentar novamente" variant="secondary" icon="refresh" onPress={retry} /> : undefined}>{message}</Notice>;
}
export function Empty({ title, description }: { title: string; description: string }) {
  return <Card style={{ alignItems: 'center', paddingVertical: 36 }}><Icon name="book" size={30} /><Text style={s.h3}>{title}</Text>
    <Text style={[s.muted, { textAlign: 'center' }]}>{description}</Text></Card>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 7 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label}
    placeholderTextColor="#849084" {...props} style={[s.input, props.style]} /></View>;
}
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
    style={{ height: 7, borderRadius: 5, backgroundColor: '#E6EADC', overflow: 'hidden' }}>
    <View style={{ height: 7, width: `${clamped}%`, backgroundColor: colors.forest, borderRadius: 5 }} /></View>;
}
export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (n: number) => void }) {
  if (total <= pageSize && page === 1) return null;
  return <View style={[s.between, { flexWrap: 'wrap' }]}><Button label="Anterior" icon="back" variant="secondary" compact disabled={page <= 1} onPress={() => onChange(page - 1)} />
    <Text style={s.small}>Página {page} de {Math.max(1, Math.ceil(total / pageSize))}</Text>
    <Button label="Próxima" icon="arrow" variant="secondary" compact disabled={page * pageSize >= total} onPress={() => onChange(page + 1)} /></View>;
}
export function SourceLink({ url, label = 'Ver fonte original' }: { url: string; label?: string }) {
  const [error, setError] = React.useState<string | null>(null);
  if (!/^https?:\/\//i.test(url)) return null;
  return <View><Button label={label} variant="ghost" compact icon="arrow" onPress={() => {
    void Linking.openURL(url).catch(() => setError('Não foi possível abrir o link.'));
  }} />{error ? <Text style={s.small}>{error}</Text> : null}</View>;
}
export const levels = { beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado' };
export const categories = { fundamentals: 'Fundamentos', tactics: 'Tática', openings: 'Aberturas', endgames: 'Finais' };
