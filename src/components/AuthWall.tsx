import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  titulo?: string;
  mensagem?: string;
}

/**
 * Aviso de "crie sua conta" exibido quando um convidado (anônimo) tenta uma
 * ação que exige conta. Ao confirmar, encerra a sessão de convidado — o app
 * cai na tela de login/cadastro (AuthStack).
 */
export function AuthWall({ visible, onClose, titulo, mensagem }: Props) {
  const { signOut } = useAuth();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.emoji}>🔒</Text>
          <Text style={styles.titulo}>{titulo ?? 'Crie sua conta grátis'}</Text>
          <Text style={styles.msg}>
            {mensagem ?? 'Pra usar essa função você precisa de uma conta. É rápido e gratuito.'}
          </Text>

          <Pressable style={styles.btnPrimary} onPress={() => signOut()}>
            <Text style={styles.btnPrimaryText}>Entrar ou criar conta</Text>
          </Pressable>
          <Pressable style={styles.btnGhost} onPress={onClose}>
            <Text style={styles.btnGhostText}>Agora não, continuar olhando</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,24,55,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emoji: { fontSize: 44, marginBottom: spacing.sm },
  titulo: { fontSize: 20, fontWeight: '800', color: colors.navy, textAlign: 'center', marginBottom: spacing.xs },
  msg: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    width: '100%',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnGhost: { paddingVertical: spacing.md, marginTop: spacing.xs, alignItems: 'center', width: '100%' },
  btnGhostText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
