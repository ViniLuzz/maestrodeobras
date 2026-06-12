import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, radius } from '@/lib/theme';

export interface SubMenuItem {
  label: string;
  emoji: string;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  items: SubMenuItem[];
  onClose: () => void;
}

export function SubMenuModal({ visible, title, items, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.menu}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.divider} />
          {items.map((item, idx) => (
            <Pressable
              key={idx}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => {
                item.onPress();
                onClose();
              }}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={styles.label}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    minWidth: 280,
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  itemPressed: {
    backgroundColor: colors.primary + '15',
  },
  emoji: {
    fontSize: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
});
