import React, { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigation } from '../../navigation/Navigation';
import { Button, Notice } from '../../ui/components';
import { s } from '../../ui/theme';
import type { OpeningAttemptResult } from './education-contracts';
import { openingCompletions, type CompletedOpening } from './training';

export function useOpeningCompletions() {
  const { user, restoring, refreshProgress } = useAuth();
  const records = useSyncExternalStore(openingCompletions.subscribe, openingCompletions.getSnapshot, openingCompletions.getSnapshot);
  const save = useCallback(async (record: CompletedOpening) => {
    if (!user || restoring) return;
    await openingCompletions.save(record.attempt.requestId, user.id,
      (id, attempt) => api.post<OpeningAttemptResult>(`/learning/openings/${encodeURIComponent(id)}/attempt`, attempt));
    if (openingCompletions.getSnapshot().find(item => item.attempt.requestId === record.attempt.requestId)?.status === 'saved') refreshProgress();
  }, [user?.id, restoring, refreshProgress]);
  useEffect(() => {
    if (!user || restoring) return;
    // Sequential dispatch stops if a 401 expires the account, rather than
    // sending the remainder of a guest batch with no authenticated session.
    let active = true;
    void (async () => {
      for (const record of records) {
        if (!active) break;
        if (record.status === 'pending' && (!record.ownerId || record.ownerId === user.id)) await save(record);
      }
    })();
    return () => { active = false; };
  }, [records, user?.id, restoring, save]);
  return { records: records.filter(record => user ? !record.ownerId || record.ownerId === user.id : !record.ownerId), save };
}

/** Mount in an openings screen. Also restores guest completions after returning
 * from login, without modifying the auth provider or the parent's navigation. */
export function OpeningCompletions({ onlyRequestId, onReview }: { onlyRequestId?: string; onReview?: (id: string, side: 'w' | 'b') => void }) {
  const { user } = useAuth(); const { navigate } = useNavigation();
  const { records, save } = useOpeningCompletions();
  const visible = onlyRequestId ? records.filter(record => record.attempt.requestId === onlyRequestId)
    : records.filter(record => record.status !== 'saved');
  if (!visible.length) return null;
  return <View style={s.stack}>{visible.map(record => <Notice key={record.attempt.requestId} tone={record.status === 'error' ? 'error' : record.status === 'saved' ? 'success' : 'info'}
    action={<View style={s.wrap}>
      {!user ? <Button label="Entrar para salvar conclusão" onPress={() => navigate({ screen: 'auth' })} compact /> : null}
      {user && record.status === 'error' ? <Button label="Tentar salvar novamente" compact onPress={() => { void save(record); }} /> : null}
      {record.status === 'saved' && onReview ? <Button label="Revisar esta abertura" compact variant="secondary" onPress={() => onReview(record.openingId, record.attempt.side)} /> : null}
    </View>}>
    {record.status === 'saved' ? `Conclusão salva. Próxima revisão: ${new Date(record.result!.nextReviewAt).toLocaleString('pt-BR')}.`
      : record.status === 'error' ? record.error
      : record.status === 'saving' ? 'Salvando conclusão…'
      : user ? 'Conclusão pronta para salvar.' : 'Treino concluído como convidado. Entre e volte às aberturas para salvar; mantenha o aplicativo aberto.'}
    {'\n'}{record.openingName} · {record.attempt.side === 'w' ? 'Brancas' : 'Pretas'} · {record.attempt.mistakes} erro(s) · {record.attempt.hintUsed ? 'com dica' : 'sem dica'}
  </Notice>)}{!onlyRequestId ? <Text style={s.small}>Conclusões pendentes ficam nesta sessão do aplicativo até serem salvas.</Text> : null}</View>;
}
