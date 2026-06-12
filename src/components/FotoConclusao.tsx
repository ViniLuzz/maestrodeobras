import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing } from '@/lib/theme';

interface Props {
  fotos: ImagePicker.ImagePickerAsset[];
  onAdd: (asset: ImagePicker.ImagePickerAsset) => void;
  onRemove: (index: number) => void;
}

const THUMB = 80;

export function FotoConclusao({ fotos, onAdd, onRemove }: Props) {
  const abrir = () => {
    Alert.alert('Registrar conclusão', 'Como deseja adicionar?', [
      {
        text: '📷 Tirar foto',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permissão necessária', 'Permita o uso da câmera nas configurações.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
          if (!result.canceled && result.assets[0]) onAdd(result.assets[0]);
        },
      },
      {
        text: '🎥 Gravar vídeo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permissão necessária', 'Permita o uso da câmera nas configurações.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'videos', videoMaxDuration: 120, quality: 0.8 });
          if (!result.canceled && result.assets[0]) onAdd(result.assets[0]);
        },
      },
      {
        text: '🖼 Escolher da galeria',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
          if (!result.canceled && result.assets[0]) onAdd(result.assets[0]);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>📷 Foto da conclusão</Text>
      <Text style={styles.hint}>
        Registre com foto ou vídeo o que foi feito. Recomendado para o dono da obra acompanhar.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {fotos.map((f, i) => (
          <View key={i} style={styles.thumbWrap}>
            <Image source={{ uri: f.uri }} style={styles.thumb} resizeMode="cover" />
            {f.type === 'video' && (
              <View style={styles.videoBadge}>
                <Text style={styles.videoIcon}>▶</Text>
              </View>
            )}
            <Pressable style={styles.removeBtn} onPress={() => onRemove(i)}>
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.addBtn} onPress={abrir}>
          <Text style={styles.addIcon}>+</Text>
          <Text style={styles.addLabel}>Adicionar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: spacing.md,
  },
  label: { fontSize: 14, fontWeight: '700', color: '#15803d', marginBottom: 4 },
  hint: { fontSize: 12, color: '#166534', marginBottom: spacing.sm, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumbWrap: { position: 'relative' },
  thumb: { width: THUMB, height: THUMB, borderRadius: 8 },
  videoBadge: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
  },
  videoIcon: { color: '#fff', fontSize: 22 },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  addBtn: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#86efac',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcfce7',
    gap: 4,
  },
  addIcon: { fontSize: 26, color: '#16a34a', lineHeight: 30 },
  addLabel: { fontSize: 10, color: '#16a34a', fontWeight: '600' },
});
