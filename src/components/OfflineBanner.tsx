import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/lib/theme';

export function OfflineBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>📵  Sem conexão — exibindo dados salvos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#78350f',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  text: { color: '#fef3c7', fontSize: 12, fontWeight: '600' },
});
