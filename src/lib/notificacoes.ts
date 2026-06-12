import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';

// Mostra a notificação mesmo com o app aberto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CANAL = 'prazos';
const MAX_AGENDADAS = 50; // iOS limita ~64 notificações agendadas; deixamos margem.

/** Cria o canal Android (necessário pra som/prioridade) — chamar uma vez no boot. */
export async function configurarNotificacoes() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Prazos da obra',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => {});
  }
}

/** Pede permissão de notificações. Retorna true se concedida. */
export async function pedirPermissaoNotificacoes(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    let final = status;
    if (status !== 'granted') {
      final = (await Notifications.requestPermissionsAsync()).status;
    }
    return final === 'granted';
  } catch {
    return false;
  }
}

// Data às 09:00 local para um prazo (YYYY-MM-DD) deslocado em `offsetDias`.
function as9h(dataStr: string, offsetDias: number): Date {
  const [y, m, d] = dataStr.split('-').map(Number);
  return new Date(y, m - 1, d + offsetDias, 9, 0, 0, 0);
}

function formataBR(dataStr: string): string {
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}

type ItemPrazo = { nome: string; prazo: string; obra: string };

type Agendamento = { when: Date; title: string; body: string };

/**
 * Reagenda TODOS os lembretes de prazo do usuário (cancela e recria a partir do
 * estado atual do banco). Agenda D-3, D-1 e no dia do vencimento, às 9h.
 * As linhas vêm filtradas por RLS — só as obras que o usuário pode ver.
 */
export async function reagendarLembretesDePrazo(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const [etRes, matRes, conRes, obrasRes] = await Promise.all([
      supabase.from('etapas')
        .select('nome, data_previsao_fim, obra_id')
        .eq('deletado', false)
        .not('data_previsao_fim', 'is', null)
        .neq('status', 'concluida').neq('status', 'cancelada'),
      supabase.from('materiais')
        .select('nome, data_previsao, obra_id')
        .eq('deletado', false)
        .not('data_previsao', 'is', null)
        .neq('status', 'entregue').neq('status', 'cancelado'),
      supabase.from('contratacoes')
        .select('nome, data_previsao_fim, obra_id')
        .eq('deletado', false)
        .not('data_previsao_fim', 'is', null)
        .neq('status', 'concluida').neq('status', 'cancelada'),
      supabase.from('obras').select('id, nome'),
    ]);

    const nomeObra = new Map<string, string>();
    ((obrasRes.data ?? []) as { id: string; nome: string }[]).forEach(o => nomeObra.set(o.id, o.nome));

    const itens: ItemPrazo[] = [
      ...((etRes.data ?? []) as { nome: string; data_previsao_fim: string; obra_id: string }[])
        .map(e => ({ nome: e.nome, prazo: e.data_previsao_fim, obra: nomeObra.get(e.obra_id) ?? 'Obra' })),
      ...((matRes.data ?? []) as { nome: string; data_previsao: string; obra_id: string }[])
        .map(m => ({ nome: m.nome, prazo: m.data_previsao, obra: nomeObra.get(m.obra_id) ?? 'Obra' })),
      ...((conRes.data ?? []) as { nome: string; data_previsao_fim: string; obra_id: string }[])
        .map(c => ({ nome: c.nome, prazo: c.data_previsao_fim, obra: nomeObra.get(c.obra_id) ?? 'Obra' })),
    ];

    const agora = Date.now();
    const candidatos: Agendamento[] = [];

    for (const it of itens) {
      const venc = formataBR(it.prazo);
      const marcos: { offset: number; title: string; body: string }[] = [
        { offset: -3, title: '⏳ Faltam 3 dias', body: `${it.nome} (${it.obra}) vence em ${venc}.` },
        { offset: -1, title: '⏳ Vence amanhã', body: `${it.nome} (${it.obra}) vence em ${venc}.` },
        { offset: 0, title: '🔔 Vence hoje', body: `${it.nome} (${it.obra}) vence hoje.` },
      ];
      for (const mk of marcos) {
        const when = as9h(it.prazo, mk.offset);
        if (when.getTime() > agora) {
          candidatos.push({ when, title: mk.title, body: mk.body });
        }
      }
    }

    // Agenda os mais próximos primeiro, respeitando o limite do SO.
    candidatos.sort((a, b) => a.when.getTime() - b.when.getTime());

    for (const c of candidatos.slice(0, MAX_AGENDADAS)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: c.title, body: c.body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: c.when,
          channelId: CANAL,
        },
      });
    }
  } catch (e) {
    console.warn('reagendarLembretesDePrazo falhou', e);
  }
}
