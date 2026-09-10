import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useOperation } from '../../api/hooks';
import { API_URL } from '../../api/client';
import { useNavigation } from '../../navigation/Navigation';
import { Badge, Button, Card, ErrorState, Field, Heading, Loading, Notice } from '../../ui/components';
import { BrandMark } from '../../ui/Icon';
import { colors, s } from '../../ui/theme';

export function AuthScreen() {
  const auth = useAuth();
  const { back, navigate } = useNavigation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); const [validation, setValidation] = useState<string | null>(null);
  const operation = useOperation();
  if (auth.restoring) return <Loading label="Restaurando sua sessão…" />;
  if (auth.user) return <View style={s.page}><Heading eyebrow="Seu perfil" title={`Olá, ${auth.user.name.split(' ')[0]}.`} description="Sua conta e seu aprendizado, no mesmo lugar." />
    <Card><View style={s.row}><BrandMark /><View style={s.grow}><Text style={s.h2}>{auth.user.name}</Text><Text selectable style={s.muted}>{auth.user.email}</Text></View></View>
      <View style={s.wrap}><Badge>{auth.user.rating} de rating no cadastro da sessão</Badge></View>
      <Text style={s.muted}>Acompanhe os valores atualizados de XP, rating e suas atividades no início.</Text>
      <Button label="Ver meu progresso" icon="arrow" onPress={() => navigate({ screen: 'home' })} />
      <Button label="Sair da conta" variant="secondary" busy={operation.busy} onPress={() => void operation.run(async signal => { await auth.logout(signal); setPassword(''); })} />
      {operation.error ? <ErrorState message={operation.error} /> : null}</Card>
      <Text selectable style={s.small}>Servidor configurado: {API_URL}</Text></View>;
  const submit = () => {
    setValidation(null);
    if (mode === 'register' && name.trim().length < 2) { setValidation('Informe seu nome com pelo menos 2 caracteres.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setValidation('Informe um e-mail válido.'); return; }
    if (!password || (mode === 'register' && password.length < 8)) { setValidation(mode === 'register' ? 'Use uma senha com pelo menos 8 caracteres.' : 'Informe sua senha.'); return; }
    void operation.run(async signal => {
      await auth.authenticate(mode, { email: email.trim().toLowerCase(), password, ...(mode === 'register' ? { name: name.trim() } : {}) }, signal);
      setPassword(''); back();
    });
  };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ alignSelf: 'center', width: '100%', maxWidth: 470 }}>
    <View style={s.page}><Button label="Voltar" icon="back" variant="ghost" onPress={back} style={{ alignSelf: 'flex-start' }} />
      <Heading eyebrow="Seu próximo capítulo" title={mode === 'login' ? 'Bom ter você aqui.' : 'Comece sua jornada.'}
        description={mode === 'login' ? 'Entre para retomar as aulas e salvar suas conquistas.' : 'Uma conta para aprender, praticar e acompanhar sua evolução.'} />
      <Card style={{ padding: 26 }}>
        {mode === 'register' ? <Field label="Seu nome" placeholder="Como podemos chamar você?" value={name} onChangeText={setName} autoComplete="name" textContentType="name" editable={!operation.busy} maxLength={100} /> : null}
        <Field label="E-mail" placeholder="voce@exemplo.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!operation.busy} maxLength={254} />
        <Field label="Senha" placeholder={mode === 'register' ? 'Pelo menos 8 caracteres' : 'Sua senha'} value={password} onChangeText={setPassword} secureTextEntry={!showPassword}
          autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} textContentType={mode === 'register' ? 'newPassword' : 'password'}
          editable={!operation.busy} onSubmitEditing={submit} returnKeyType="go" />
        <Button compact label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} variant="ghost" onPress={() => setShowPassword(v => !v)} style={{ alignSelf: 'flex-start' }} />
        {validation || operation.error ? <ErrorState message={validation ?? operation.error!} /> : null}
        <Button label={mode === 'login' ? 'Entrar na minha conta' : 'Criar conta'} busy={operation.busy} onPress={submit} icon="arrow" />
        <View style={s.separator} /><Text style={[s.small, { textAlign: 'center' }]}>{mode === 'login' ? 'Ainda não tem uma conta?' : 'Já aprende com a gente?'}</Text>
        <Button label={mode === 'login' ? 'Criar uma conta' : 'Já tenho uma conta'} variant="secondary" disabled={operation.busy} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setValidation(null); operation.clearError(); }} />
      </Card><Notice>Você pode explorar aulas, aberturas, finais e análise sem conta. Entre para registrar aulas e puzzles.</Notice>
      <Text style={[s.small, { color: colors.muted }]}>A sessão usa armazenamento seguro no celular e dura apenas esta sessão do navegador na web.</Text>
    </View></KeyboardAvoidingView>;
}
