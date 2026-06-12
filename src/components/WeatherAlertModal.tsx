import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/lib/theme';

type Props = {
  visible: boolean;
  taskName: string;
  climaDesc: string;
  onConfirm: () => void;
  onBlock: () => void;
};

export function WeatherAlertModal({ visible, taskName, climaDesc, onConfirm, onBlock }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.icon}>⛈️</Text>
          <Text style={styles.titulo}>Atenção: {climaDesc}</Text>
          <Text style={styles.mensagem}>
            A tarefa{' '}
            <Text style={styles.destaque}>"{taskName}"</Text>
            {' '}parece ser em área externa ou sensível ao clima.{'\n\n'}
            Você conseguiu realizá-la mesmo assim?
          </Text>

          <Pressable style={styles.btnSim} onPress={onConfirm}>
            <Text style={styles.btnSimText}>✅  Sim, foi realizada</Text>
          </Pressable>

          <Pressable style={styles.btnNao} onPress={onBlock}>
            <Text style={styles.btnNaoText}>🚫  Não — tempo impediu</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: { fontSize: 48, marginBottom: spacing.sm },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
    textTransform: 'capitalize',
  },
  mensagem: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  destaque: { color: colors.text, fontWeight: '600' },
  btnSim: {
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: spacing.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  btnSimText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnNao: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  btnNaoText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
});
