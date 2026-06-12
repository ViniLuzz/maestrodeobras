import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { EditarPerfilModal } from '@/components/EditarPerfilModal';
import { colors, radius, spacing } from '@/lib/theme';
import { LINKS } from '@/lib/links';
import type { TabScreenProps } from '@/navigation/types';
import type { Pessoa } from '@/types/database';

export function ConfiguracoesScreen({ navigation }: TabScreenProps<'Conta'>) {
  const { user, pessoa, signOut, isLoading, isAnon, refreshPessoa, excluirConta } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);

  const confirmarExclusao = () => {
    Alert.alert(
      'Excluir minha conta',
      'Isso remove sua conta e seus dados pessoais permanentemente. Esta ação não pode ser desfeita. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir conta',
          style: 'destructive',
          onPress: async () => {
            try {
              await excluirConta();
            } catch (e: unknown) {
              Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível excluir a conta.');
            }
          },
        },
      ],
    );
  };

  const handleSavePerfil = async (pessoaAtualizada: Pessoa) => {
    try {
      const { error } = await supabase
        .from('pessoas')
        .update({
          nome: pessoaAtualizada.nome,
          avatar_url: pessoaAtualizada.avatar_url,
        })
        .eq('id', pessoaAtualizada.id);

      if (error) throw error;
      await refreshPessoa();
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      throw err;
    }
  };

  if (!pessoa) {
    // Convidado (anônimo sem perfil): convida a criar conta.
    if (isAnon) {
      return (
        <View style={styles.guestWrap}>
          <Text style={styles.guestEmoji}>👤</Text>
          <Text style={styles.guestTitle}>Sua conta, suas obras</Text>
          <Text style={styles.guestText}>
            Crie sua conta grátis pra ter seu perfil, gerenciar obras, alugar equipamentos e contratar profissionais.
          </Text>
          <View style={{ height: spacing.lg }} />
          <PrimaryButton title="Entrar ou criar conta" onPress={signOut} loading={isLoading} />
        </View>
      );
    }
    // Conta real ainda carregando o perfil.
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: colors.background }}>
      {/* Modal de edição */}
      <EditarPerfilModal
        visible={modalVisible}
        pessoa={pessoa}
        onClose={() => setModalVisible(false)}
        onSave={handleSavePerfil}
      />

      <Text style={styles.title}>Conta</Text>

      {/* Avatar section */}
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          {pessoa.avatar_url ? (
            <Image
              source={{ uri: pessoa.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>
                {pessoa.nome.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.editBtnText}>✏️ Editar Perfil</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Nome</Text>
        <Text style={styles.value}>{pessoa.nome}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? '—'}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Plano</Text>
        <Text style={styles.value}>{pessoa?.plano_ativo ? 'Ativo' : 'Gratuito (freemium)'}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>É admin de obra</Text>
        <Text style={styles.value}>{pessoa?.is_admin ? 'Sim' : 'Não'}</Text>
      </View>

      <View style={{ height: spacing.lg }} />
      <PrimaryButton
        title="Marketplace de prestadores"
        variant="secondary"
        onPress={() => navigation.navigate('MeuPerfilMarketplace')}
      />
      <View style={{ height: spacing.sm }} />
      <PrimaryButton title="Sair" variant="danger" onPress={signOut} loading={isLoading} />

      {/* Legal */}
      <View style={styles.legalRow}>
        <Pressable onPress={() => Linking.openURL(LINKS.privacidade)}>
          <Text style={styles.legalLink}>Política de Privacidade</Text>
        </Pressable>
        <Text style={styles.legalSep}>·</Text>
        <Pressable onPress={() => Linking.openURL(LINKS.termos)}>
          <Text style={styles.legalLink}>Termos de Uso</Text>
        </Pressable>
      </View>

      {/* Excluir conta (exigência das lojas / LGPD) */}
      <Pressable onPress={confirmarExclusao} style={styles.excluirBtn}>
        <Text style={styles.excluirText}>Excluir minha conta</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  guestWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.xl },
  guestEmoji: { fontSize: 56, marginBottom: spacing.md },
  guestTitle: { fontSize: 22, fontWeight: '800', color: colors.navy, marginBottom: spacing.sm, textAlign: 'center' },
  guestText: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  legalLink: { fontSize: 13, color: colors.textMuted, textDecorationLine: 'underline' },
  legalSep: { fontSize: 13, color: colors.textMuted },
  excluirBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  excluirText: { fontSize: 14, color: colors.danger, fontWeight: '600' },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },

  profileSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
  },
  editBtn: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  editBtnPressed: {
    opacity: 0.7,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 14, color: colors.textMuted },
  value: { fontSize: 14, color: colors.text, fontWeight: '500' },
});
