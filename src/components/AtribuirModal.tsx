import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import type { Membro } from '@/hooks/useObraMembros';

interface Props {
  visible: boolean;
  membros: Membro[];
  loading: boolean;
  onSelect: (membro: Membro) => void;
  onClose: () => void;
  titulo?: string;
}

export function AtribuirModal({
  visible,
  membros,
  loading,
  onSelect,
  onClose,
  titulo = 'Atribuir a',
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{titulo}</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : membros.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhum membro na obra</Text>
            </View>
          ) : (
            <FlatList
              data={membros}
              keyExtractor={m => m.pessoa_id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.membroItem, pressed && styles.membroItemPressed]}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  {item.avatar_url ? (
                    <Image
                      source={{ uri: item.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: item.cor }]}>
                      <Text style={styles.avatarText}>{item.nome.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.membroInfo}>
                    <Text style={styles.membroNome}>{item.nome}</Text>
                    {item.email && <Text style={styles.membroEmail}>{item.email}</Text>}
                  </View>
                  <Text style={styles.arrow}>›</Text>
                </Pressable>
              )}
            />
          )}

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderNeutral,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
  },
  closeBtn: {
    fontSize: 24,
    color: colors.textMuted,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  list: {
    paddingVertical: spacing.sm,
  },
  membroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderNeutral,
  },
  membroItemPressed: {
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: spacing.md,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  membroInfo: {
    flex: 1,
  },
  membroNome: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.navy,
    marginBottom: 2,
  },
  membroEmail: {
    fontSize: 12,
    color: colors.textMuted,
  },
  arrow: {
    fontSize: 20,
    color: colors.borderNeutral,
  },
  cancelBtn: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '600',
  },
});
