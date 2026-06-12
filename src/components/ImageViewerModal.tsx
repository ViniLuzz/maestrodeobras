import { Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

type Props = { uri: string | null; onClose: () => void };

/**
 * Visualizador de imagem em tela cheia. Toque em qualquer lugar para fechar.
 * Usado, por exemplo, nas fotos do RDO (pra ver em tamanho grande).
 */
export function ImageViewerModal({ uri, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {uri && (
          <Image
            source={{ uri }}
            style={{ width, height: height * 0.82 }}
            resizeMode="contain"
          />
        )}
        <View style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </View>
        <Text style={styles.hint}>Toque para fechar</Text>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 44,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  hint: { position: 'absolute', bottom: 40, color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});
