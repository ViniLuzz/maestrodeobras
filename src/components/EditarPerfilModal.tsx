import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useUploadAvatar } from '@/hooks/useUploadAvatar';
import { colors, radius, spacing } from '@/lib/theme';
import type { Pessoa } from '@/types/database';

interface Props {
  visible: boolean;
  pessoa: Pessoa;
  onClose: () => void;
  onSave: (pessoa: Pessoa) => Promise<void>;
}

export function EditarPerfilModal({ visible, pessoa, onClose, onSave }: Props) {
  const [nome, setNome] = useState(pessoa.nome);
  const [avatarUrl, setAvatarUrl] = useState(pessoa.avatar_url);
  const [saving, setSaving] = useState(false);
  const { pickImage, uploadAvatar, uploading: uploadingImage } = useUploadAvatar();

  const handlePickImage = async () => {
    const image = await pickImage();
    if (!image) return;

    try {
      const url = await uploadAvatar(pessoa.id, image);
      setAvatarUrl(url);
    } catch (err) {
      Alert.alert('Erro', 'Falha ao fazer upload da foto');
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      Alert.alert('Erro', 'Nome não pode estar vazio');
      return;
    }

    try {
      setSaving(true);
      const pessoaAtualizada: Pessoa = {
        ...pessoa,
        nome: nome.trim(),
        avatar_url: avatarUrl,
      };
      await onSave(pessoaAtualizada);
      onClose();
    } catch (err) {
      Alert.alert('Erro', 'Falha ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Editar Perfil</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            {/* Avatar */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarPlaceholderText}>
                      {nome.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.changePhotoBtn,
                  pressed && styles.changePhotoBtnPressed,
                  uploadingImage && { opacity: 0.5 },
                ]}
                onPress={handlePickImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.changePhotoText}>📷 Alterar foto</Text>
                )}
              </Pressable>
            </View>

            {/* Nome */}
            <View style={styles.field}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Digite seu nome"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Email (read-only) */}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>{pessoa.email || '—'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Salvar</Text>
              )}
            </Pressable>
          </View>
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
    maxHeight: '85%',
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

  body: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },

  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },

  changePhotoBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  changePhotoBtnPressed: {
    opacity: 0.8,
  },
  changePhotoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  field: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderNeutral,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },

  readOnlyInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderNeutral,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  readOnlyText: {
    fontSize: 16,
    color: colors.textMuted,
  },

  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderNeutral,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderNeutral,
  },
  cancelBtnPressed: {
    opacity: 0.7,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.navy,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveBtnPressed: {
    opacity: 0.8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
