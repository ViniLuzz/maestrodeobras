import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import type { ObraMembroComPessoa } from '@/types/database';
import type { AppScreenProps } from '@/navigation/types';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  trabalhador: 'Trabalhador',
};

export function AdministracaoObraScreen({ route }: AppScreenProps<'AdministracaoObra'>) {
  const { obraId } = route.params;
  const { pessoa } = useAuth();
  const [membros, setMembros] = useState<ObraMembroComPessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [obra, setObra] = useState<{ admin_id: string; nome: string; token_convite: string | null } | null>(null);
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    const [membrosRes, obraRes] = await Promise.all([
      supabase
        .from('obra_membros')
        .select('*, pessoa:pessoas(id, nome, email, telefone, cor)')
        .eq('obra_id', obraId)
        .order('criado_em', { ascending: true }),
      supabase
        .from('obras')
        .select('id, admin_id, nome, token_convite, pessoas!admin_id(id, nome, email, telefone, cor)')
        .eq('id', obraId)
        .single(),
    ]);

    // Construir lista de membros incluindo admin
    const membrosMap = new Map<string, ObraMembroComPessoa>();

    // Adicionar membros da obra
    if (membrosRes.data) {
      membrosRes.data.forEach(m => {
        membrosMap.set(m.id, m as ObraMembroComPessoa);
      });
    }

    // Adicionar admin se não estiver duplicado
    if (obraRes.data) {
      const adminPessoa = (obraRes.data as any).pessoas;
      if (adminPessoa && !Array.from(membrosMap.values()).some(m => m.pessoa_id === adminPessoa.id)) {
        const adminMembro: ObraMembroComPessoa = {
          id: `admin-${adminPessoa.id}`,
          obra_id: obraId,
          pessoa_id: adminPessoa.id,
          role: 'admin',
          ativo: true,
          token_acesso: null,
          expira_em: null,
          convidado_por: null,
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
          pessoa: adminPessoa,
        };
        membrosMap.set(adminMembro.id, adminMembro);
      }
      setObra({
        admin_id: (obraRes.data as any).admin_id,
        nome: (obraRes.data as any).nome,
        token_convite: (obraRes.data as any).token_convite,
      });
    } else if (obraRes.error) {
      // token_convite pode não existir antes da migration ser aplicada — usa fallback
      const { data: fallback } = await supabase
        .from('obras')
        .select('admin_id, nome')
        .eq('id', obraId)
        .single();
      if (fallback) {
        setObra({ ...(fallback as { admin_id: string; nome: string }), token_convite: null });
      }
    }

    setMembros(Array.from(membrosMap.values()));
  }, [obraId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await carregar();
      setLoading(false);
    })();
  }, [carregar]);

  const isAdmin = obra?.admin_id === pessoa?.id;

  const onGerarToken = () => {
    const acao = obra?.token_convite ? 'Gerar novo código' : 'Gerar código';
    const msg = obra?.token_convite
      ? 'Isso invalidará o código atual. Quem já entrou na obra não é afetado.'
      : 'Um código de acesso será gerado para esta obra.';
    Alert.alert(acao, msg, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Gerar',
        onPress: async () => {
          setGerando(true);
          try {
            const { data, error } = await supabase.rpc('gerar_token_obra', { _obra_id: obraId });
            if (error) throw new Error(error.message);
            setObra(prev => prev ? { ...prev, token_convite: data as string } : prev);
          } catch (e: unknown) {
            Alert.alert('Erro ao gerar código', e instanceof Error ? e.message : String(e));
          } finally {
            setGerando(false);
          }
        },
      },
    ]);
  };

  const onCompartilhar = async () => {
    const token = obra?.token_convite;
    if (!token) return;
    try {
      await Share.share({
        message: `Você foi convidado para a obra "${obra?.nome}" no Maestro de Obras.\n\nCódigo de acesso: ${token}\n\nBaixe o app e use o código para entrar.`,
      });
    } catch {}
  };

  const onToggleAtivo = async (membro: ObraMembroComPessoa) => {
    if (!isAdmin) {
      Alert.alert('Sem permissão', 'Apenas o administrador pode alterar membros.');
      return;
    }
    if (membro.pessoa_id === pessoa?.id) {
      Alert.alert('Atenção', 'Você não pode desativar a si mesmo.');
      return;
    }
    const novoAtivo = !membro.ativo;
    const acao = novoAtivo ? 'reativar' : 'desativar';
    Alert.alert(
      `${novoAtivo ? 'Reativar' : 'Desativar'} membro`,
      `Deseja ${acao} ${membro.pessoa.nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: novoAtivo ? 'Reativar' : 'Desativar',
          style: novoAtivo ? 'default' : 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('obra_membros')
              .update({ ativo: novoAtivo })
              .eq('id', membro.id);
            if (error) {
              Alert.alert('Erro', error.message);
            } else {
              await carregar();
            }
          },
        },
      ]
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!isAdmin && (
        <View style={styles.aviso}>
          <Text style={styles.avisoText}>Somente o administrador pode gerenciar membros.</Text>
        </View>
      )}

      <FlatList
        data={membros}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await carregar();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>Membros da obra</Text>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhum membro encontrado.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.ativo && styles.cardInativo]}>
            <View style={styles.cardLeft}>
              <View style={[styles.avatar, { backgroundColor: item.pessoa.cor ?? colors.primary }]}>
                <Text style={styles.avatarText}>
                  {item.pessoa.nome.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.nome}>{item.pessoa.nome}</Text>
                {item.pessoa.email ? (
                  <Text style={styles.meta}>{item.pessoa.email}</Text>
                ) : null}
                <Text style={styles.role}>{ROLE_LABEL[item.role] ?? item.role}</Text>
              </View>
            </View>

            <View style={styles.cardRight}>
              <View style={[styles.statusBadge, item.ativo ? styles.statusAtivo : styles.statusInativo]}>
                <Text style={[styles.statusText, item.ativo ? styles.statusAtivoText : styles.statusInativoText]}>
                  {item.ativo ? 'Ativo' : 'Inativo'}
                </Text>
              </View>
              {isAdmin && item.pessoa_id !== pessoa?.id && (
                <Pressable style={styles.toggleBtn} onPress={() => onToggleAtivo(item)}>
                  <Text style={styles.toggleBtnText}>{item.ativo ? 'Desativar' : 'Reativar'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      />

      {isAdmin && (
        <View style={styles.tokenSection}>
          <Text style={styles.tokenTitle}>Convidar trabalhadores</Text>
          <Text style={styles.tokenSub}>
            Compartilhe o código abaixo. O trabalhador entra no app, digita o código e o nome, e já está na obra.
          </Text>

          {obra?.token_convite ? (
            <>
              <View style={styles.tokenBox}>
                <Text style={styles.tokenValue} selectable>{obra.token_convite}</Text>
              </View>
              <View style={styles.tokenBtns}>
                <Pressable style={[styles.tokenBtn, styles.tokenBtnShare]} onPress={onCompartilhar}>
                  <Text style={styles.tokenBtnShareText}>Compartilhar</Text>
                </Pressable>
                <Pressable style={styles.tokenBtn} onPress={onGerarToken} disabled={gerando}>
                  <Text style={styles.tokenBtnText}>{gerando ? 'Gerando...' : 'Novo código'}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable style={styles.tokenBtnGerar} onPress={onGerarToken} disabled={gerando}>
              <Text style={styles.tokenBtnGerarText}>{gerando ? 'Gerando...' : 'Gerar código de convite'}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  aviso: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: '#fde68a',
  },
  avisoText: { fontSize: 13, color: '#92400e' },
  lista: { padding: spacing.md, paddingBottom: 1000 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInativo: { opacity: 0.6 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  info: { flex: 1 },
  nome: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  role: { fontSize: 12, color: colors.primary, fontWeight: '500', marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: spacing.xs },
  statusBadge: { borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusAtivo: { backgroundColor: colors.success + '22' },
  statusInativo: { backgroundColor: colors.danger + '22' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusAtivoText: { color: colors.success },
  statusInativoText: { color: colors.danger },
  toggleBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  toggleBtnText: { fontSize: 12, color: colors.text },
  tokenSection: {
    margin: spacing.md,
    marginBottom: 40,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tokenTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  tokenSub: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.md },
  tokenBox: {
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tokenValue: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: 6 },
  tokenBtns: { flexDirection: 'row', gap: spacing.sm },
  tokenBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tokenBtnShare: { backgroundColor: colors.primary, borderColor: colors.primary },
  tokenBtnShareText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  tokenBtnText: { fontSize: 13, fontWeight: '500', color: colors.text },
  tokenBtnGerar: {
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  tokenBtnGerarText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
