import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { uploadMidiaAsset } from '@/lib/midias';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing } from '@/lib/theme';
import type { Midia, MidiaItemTipo } from '@/types/database';
import type { AppScreenProps } from '@/navigation/types';

const COLUNAS = 3;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_W - spacing.md * 2 - spacing.xs * (COLUNAS - 1)) / COLUNAS;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

function getMidiaUrl(path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/midias/${path}`;
}

// Separate component so useVideoPlayer hook lifecycle matches the modal visibility
function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  const playedRef = useRef(false);

  useEffect(() => {
    // expo-video requires waiting for readyToPlay before calling play()
    const sub = player.addListener('statusChange', ({ status }: { status: string }) => {
      if (status === 'readyToPlay' && !playedRef.current) {
        playedRef.current = true;
        player.play();
      }
    });
    return () => sub.remove();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls
      fullscreenOptions={{ enable: true }}
      allowsPictureInPicture
    />
  );
}

export function MidiasScreen({ route, navigation }: AppScreenProps<'Midias'>) {
  const { obraId, itemTipo, itemId, itemNome } = route.params;
  const { pessoa } = useAuth();

  const [midias, setMidias] = useState<Midia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<Midia | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: itemNome });
  }, [navigation, itemNome]);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('midias')
      .select('*')
      .eq('item_tipo', itemTipo)
      .eq('item_id', itemId)
      .order('criado_em', { ascending: false });
    if (error) { console.warn(error); return; }
    setMidias((data as Midia[]) ?? []);
  }, [itemTipo, itemId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await carregar();
      setLoading(false);
    })();
  }, [carregar]);

  const uploadMidia = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    try {
      await uploadMidiaAsset(obraId, itemTipo, itemId, asset, pessoa?.id ?? null);
      await carregar();
    } catch (e: unknown) {
      Alert.alert('Erro no upload', e instanceof Error ? e.message : 'Não foi possível enviar a mídia.');
    } finally {
      setUploading(false);
    }
  };

  const abrirPicker = async (source: 'camera' | 'galeria', mediaType: ImagePicker.MediaType | ImagePicker.MediaType[]) => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Acesse Ajustes e permita o uso da câmera.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: mediaType, quality: 0.8, videoMaxDuration: 120 });
      if (!result.canceled && result.assets[0]) await uploadMidia(result.assets[0]);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Acesse Ajustes e permita o acesso à galeria.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: mediaType, quality: 0.8, videoMaxDuration: 120 });
      if (!result.canceled && result.assets[0]) await uploadMidia(result.assets[0]);
    }
  };

  const onAdicionar = () => {
    Alert.alert('Adicionar mídia', 'Como deseja registrar?', [
      { text: '📷 Tirar foto', onPress: () => abrirPicker('camera', 'images') },
      { text: '🎥 Gravar vídeo', onPress: () => abrirPicker('camera', 'videos') },
      { text: '🖼 Escolher da galeria', onPress: () => abrirPicker('galeria', ['images', 'videos']) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const onLongPress = (midia: Midia) => {
    Alert.alert('Excluir mídia', 'Deseja excluir esta mídia?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.storage.from('midias').remove([midia.storage_path]);
          await supabase.from('midias').delete().eq('id', midia.id);
          setMidias(prev => prev.filter(m => m.id !== midia.id));
        },
      },
    ]);
  };

  const fecharViewer = () => setViewer(null);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {uploading && (
        <View style={styles.uploadBanner}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.uploadText}>Enviando...</Text>
        </View>
      )}

      <FlatList
        data={midias}
        numColumns={COLUNAS}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📷</Text>
            <Text style={styles.emptyTitle}>Nenhuma foto ainda</Text>
            <Text style={styles.emptyText}>
              Registre o que foi feito com fotos ou vídeos.{'\n'}Toque em + para adicionar.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.thumb}
            onPress={() => setViewer(item)}
            onLongPress={() => onLongPress(item)}
            delayLongPress={500}
          >
            {item.tipo === 'foto' ? (
              <Image
                source={{ uri: getMidiaUrl(item.storage_path) }}
                style={styles.thumbImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.thumbImage, styles.videoThumb]}>
                <Text style={styles.videoPlayIcon}>▶</Text>
                <Text style={styles.videoLabel}>Vídeo</Text>
              </View>
            )}
          </Pressable>
        )}
      />

      <Pressable style={[styles.fab, uploading && styles.fabDisabled]} onPress={uploading ? undefined : onAdicionar}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      {midias.length > 0 && (
        <Text style={styles.hint}>Toque para abrir · Segure para excluir</Text>
      )}

      {/* Viewer modal */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={fecharViewer}>
        <StatusBar hidden />
        <View style={styles.viewerBg}>
          <Pressable style={styles.viewerClose} onPress={fecharViewer} hitSlop={16}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </Pressable>

          {viewer?.tipo === 'foto' ? (
            <ScrollView
              style={styles.viewerScroll}
              contentContainerStyle={styles.viewerScrollContent}
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: getMidiaUrl(viewer.storage_path) }}
                style={{ width: SCREEN_W, height: SCREEN_H }}
                resizeMode="contain"
              />
            </ScrollView>
          ) : viewer?.tipo === 'video' ? (
            <VideoPlayer uri={getMidiaUrl(viewer.storage_path)} />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  uploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  uploadText: { color: '#fff', fontSize: 14, fontWeight: '500' },

  grid: { padding: spacing.md, paddingBottom: 80 },
  row: { gap: spacing.xs, marginBottom: spacing.xs },

  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  thumbImage: { width: '100%', height: '100%' },
  videoThumb: { backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  videoPlayIcon: { fontSize: 28, color: '#fff' },
  videoLabel: { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  empty: { alignItems: 'center', paddingTop: spacing.xl * 2, paddingHorizontal: spacing.lg },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },

  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabDisabled: { opacity: 0.5 },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },

  hint: { textAlign: 'center', fontSize: 11, color: colors.textMuted, paddingBottom: spacing.sm },

  // Viewer
  viewerBg: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  viewerScroll: { flex: 1, width: SCREEN_W },
  viewerScrollContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  video: { width: SCREEN_W, height: SCREEN_H * 0.6 },
});
