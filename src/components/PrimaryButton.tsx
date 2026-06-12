import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

interface Props {
  onPress: () => void;
  title: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export function PrimaryButton({ onPress, title, loading, disabled, variant = 'primary' }: Props) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.btn,
    variant === 'primary' && styles.btnPrimary,
    variant === 'secondary' && styles.btnSecondary,
    variant === 'danger' && styles.btnDanger,
    variant === 'ghost' && styles.btnGhost,
    isDisabled && styles.btnDisabled,
  ];

  const textStyle = [
    styles.label,
    variant === 'primary' && styles.labelPrimary,
    variant === 'secondary' && styles.labelSecondary,
    variant === 'danger' && styles.labelDanger,
    variant === 'ghost' && styles.labelGhost,
  ];

  const indicatorColor =
    variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [containerStyle, pressed && !isDisabled && styles.btnPressed]}
    >
      {loading
        ? <ActivityIndicator color={indicatorColor} />
        : <Text style={textStyle}>{title}</Text>
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.navy,
  },
  btnDanger: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnDisabled: { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  label: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  labelPrimary: { color: '#FFFFFF' },
  labelSecondary: { color: colors.navy },
  labelDanger: { color: '#FFFFFF' },
  labelGhost: { color: colors.primary },
});
