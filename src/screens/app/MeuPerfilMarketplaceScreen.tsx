import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { uploadAvatar, uploadPortfolioFoto } from '@/lib/midias';
import { colors, spacing } from '@/lib/theme';
import type { AppScreenProps } from '@/navigation/types';

const FOTO_SIZE = (Dimensions.get('window').width - spacing.lg * 2 - spacing.sm * 2) / 3;

const ESPECIALIDADES = [
  'Pedreiro',
  'Eletricista',
  'Encanador / Hidráulico',
  'Marceneiro',
  'Pintor',
  'Gesseiro',
  'Azulejista',
  'Mestre de obras',
  'Serralheiro',
  'Soldador',
  'Engenheiro Civil',
  'Arquiteto',
  'Jardineiro',
  'Outro',
];

type PortfolioFoto = { id: string; url: string };

function Avatar({ uri, nome, size = 80 }: { uri: string | null; nome: string; size?: number }) {
  const r = size / 2;
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r }} />;
  }
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: r }]}>
      <Text style={{ fontSize: size * 0.4, color: '#fff', fontWeight: '700' }}>
        {nome.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export function MeuPerfilMarketplaceScreen(_: AppScreenProps<'MeuPerfilMarketplace'>) {
  const { pessoa, user, isAnon, refreshPessoa } = useAuth();

  const [disponivel, setDisponivel] = useState(false);
  const [especialidade, setEspecialidade] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [telefone, setTelefone] = useState('');
  const [descricao, setDescricao] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarLocal, setAvatarLocal] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Portfólio
  const [fotos, setFotos] = useState<PortfolioFoto[]>([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [fotoVisualizando, setFotoVisualizando] = useState<string | null>(null);

  useEffect(() => {
    if (!pessoa) return;
    setDisponivel(pessoa.disponivel_marketplace ?? false);
    setEspecialidade(pessoa.especialidade ?? '');
    setCidade(pessoa.cidade ?? '');
    setEstado(pessoa.estado ?? '');
    setTelefone(pessoa.telefone ?? '');
    setDescricao(pessoa.descricao_marketplace ?? '');
    setAvatarUri(pessoa.avatar_url ?? null);
  }, [pessoa]);

  const carregarFotos = useCallback(async () => {
    if (!pessoa) return;
    const { data } = await supabase
      .from('portfolio_fotos')
      .select('id, url')
      .eq('pessoa_id', pessoa.id)
      .order('criado_em', { ascending: true });
    if (data) setFotos(data as PortfolioFoto[]);
  }, [pessoa]);

  useEffect(() => {
    carregarFotos();
  }, [carregarFotos]);

  const onPickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarLocal(result.assets[0]);
      setAvatarUri(result.assets[0].uri);
    }
  };

  const onAdicionarFoto = async () => {
    if (!pessoa || !user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploadingFoto(true);
    try {
      for (const asset of result.assets) {
        const { url } = await uploadPortfolioFoto(user.id, pessoa.id, asset);
        setFotos(prev => [...prev, { id: Date.now().toString(), url }]);
      }
      await carregarFotos();
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível enviar a foto.');
    } finally {
      setUploadingFoto(false);
    }
  };

  const onRemoverFoto = (foto: PortfolioFoto) => {
    Alert.alert('Remover foto', 'Tem certeza que deseja remover esta foto do portfólio?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          await supabase.from('portfolio_fotos').delete().eq('id', foto.id);
          setFotos(prev => prev.filter(f => f.id !== foto.id));
        },
      },
    ]);
  };

  const onSalvar = async () => {
    if (!pessoa || !user) return;
    setSaving(true);
    try {
      let novoAvatarUrl = pessoa.avatar_url ?? null;
      if (avatarLocal) {
        novoAvatarUrl = await uploadAvatar(user.id, avatarLocal);
      }

      let lat: number | null = pessoa.latitude ?? null;
      let lon: number | null = pessoa.longitude ?? null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      }

      const camposBase = {
        disponivel_marketplace: disponivel,
        especialidade: especialidade.trim() || null,
        cidade: cidade.trim() || null,
        estado: estado.trim() || null,
        telefone: telefone.trim() || null,
        descricao_marketplace: descricao.trim() || null,
        avatar_url: novoAvatarUrl,
      };

      let { error } = await supabase
        .from('pessoas')
        .update({ ...camposBase, latitude: lat, longitude: lon })
        .eq('id', pessoa.id);

      // Fallback: colunas lat/lon não existem (migration 008 pendente)
      if (error?.code === '42703') {
        ({ error } = await supabase
          .from('pessoas')
          .update(camposBase)
          .eq('id', pessoa.id));
      }

      if (error) throw new Error(error.message);
      await refreshPessoa();
      Alert.alert('Salvo!', disponivel ? 'Seu perfil está visível no marketplace.' : 'Perfil atualizado.');
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (!pessoa) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {isAnon && (
          <View style={styles.anonBanner}>
            <Text style={styles.anonBannerText}>
              💡 Você está usando uma conta temporária. Peça ao admin da obra para criar sua conta permanente se quiser manter seu perfil.
            </Text>
          </View>
        )}

        {/* Avatar */}
        <View style={styles.avatarRow}>
          <Avatar uri={avatarUri} nome={pessoa.nome} size={88} />
          <Pressable style={styles.avatarBtn} onPress={onPickAvatar}>
            <Text style={styles.avatarBtnText}>Trocar foto</Text>
          </Pressable>
        </View>

        {/* Toggle visibilidade */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Aparecer no marketplace</Text>
            <Text style={styles.toggleSub}>
              {disponivel ? 'Seu perfil está visível para admins de obra' : 'Seu perfil está oculto'}
            </Text>
          </View>
          <Switch
            value={disponivel}
            onValueChange={setDisponivel}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.divider} />

        {/* Especialidade */}
        <Text style={styles.label}>Especialidade</Text>
        <Pressable style={styles.picker} onPress={() => setPickerVisible(true)}>
          <Text style={[styles.pickerText, !especialidade && { color: colors.textMuted }]}>
            {especialidade || 'Selecionar especialidade...'}
          </Text>
          <Text style={styles.pickerChevron}>›</Text>
        </Pressable>

        {/* Localização */}
        <View style={styles.row2}>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>Cidade</Text>
            <TextInput
              style={styles.input}
              value={cidade}
              onChangeText={setCidade}
              placeholder="São Paulo"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />
          </View>
          <View style={{ width: spacing.sm }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Estado</Text>
            <TextInput
              style={styles.input}
              value={estado}
              onChangeText={v => setEstado(v.toUpperCase().slice(0, 2))}
              placeholder="SP"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
        </View>

        {/* Telefone */}
        <Text style={styles.label}>WhatsApp / Telefone</Text>
        <TextInput
          style={styles.input}
          value={telefone}
          onChangeText={setTelefone}
          keyboardType="phone-pad"
          placeholder="(11) 99999-9999"
          placeholderTextColor={colors.textMuted}
        />

        {/* Descrição */}
        <Text style={styles.label}>Sobre você</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={descricao}
          onChangeText={setDescricao}
          multiline
          numberOfLines={4}
          placeholder="Descreva sua experiência, serviços oferecidos, diferenciais..."
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />

        <Pressable
          style={[styles.btnPrimary, saving && styles.btnDisabled]}
          onPress={onSalvar}
          disabled={saving}
        >
          <Text style={styles.btnPrimaryText}>{saving ? 'Salvando...' : 'Salvar perfil'}</Text>
        </Pressable>

        <View style={{ marginTop: spacing.lg, height: 1, backgroundColor: colors.border, marginBottom: spacing.md }} />

        {/* Portfólio de fotos */}
        <View style={styles.portfolioHeader}>
          <Text style={styles.label}>Fotos de serviços</Text>
          <Pressable
            style={[styles.portfolioAddBtn, uploadingFoto && styles.btnDisabled]}
            onPress={onAdicionarFoto}
            disabled={uploadingFoto}
          >
            {uploadingFoto
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={styles.portfolioAddBtnText}>+ Adicionar</Text>
            }
          </Pressable>
        </View>

        {fotos.length === 0 ? (
          <Pressable style={styles.portfolioEmpty} onPress={onAdicionarFoto} disabled={uploadingFoto}>
            <Text style={styles.portfolioEmptyIcon}>📷</Text>
            <Text style={styles.portfolioEmptyText}>
              Adicione fotos de serviços que você já realizou. Isso aumenta muito suas chances de ser contratado.
            </Text>
          </Pressable>
        ) : (
          <View style={styles.portfolioGrid}>
            {fotos.map(foto => (
              <Pressable
                key={foto.id}
                style={styles.portfolioThumb}
                onPress={() => setFotoVisualizando(foto.url)}
                onLongPress={() => onRemoverFoto(foto)}
              >
                <Image source={{ uri: foto.url }} style={styles.portfolioThumbImg} />
                <Pressable style={styles.portfolioRemoveBtn} onPress={() => onRemoverFoto(foto)}>
                  <Text style={styles.portfolioRemoveBtnText}>✕</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}

        {fotos.length > 0 && (
          <Text style={styles.portfolioHint}>Pressione e segure uma foto para removê-la.</Text>
        )}

        <View style={{ height: spacing.xl }} />

      </ScrollView>

      {/* Picker de especialidade */}
      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setPickerVisible(false)} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerHeaderTitle}>Especialidade</Text>
            <Pressable onPress={() => setPickerVisible(false)}>
              <Text style={styles.pickerHeaderClose}>Fechar</Text>
            </Pressable>
          </View>
          <FlatList
            data={ESPECIALIDADES}
            keyExtractor={i => i}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.pickerItem, item === especialidade && styles.pickerItemSelected]}
                onPress={() => { setEspecialidade(item); setPickerVisible(false); }}
              >
                <Text style={[styles.pickerItemText, item === especialidade && styles.pickerItemTextSelected]}>
                  {item}
                </Text>
                {item === especialidade && <Text style={styles.pickerCheckmark}>✓</Text>}
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Visualizador de foto em tela cheia */}
      <Modal
        visible={!!fotoVisualizando}
        transparent
        animationType="fade"
        onRequestClose={() => setFotoVisualizando(null)}
      >
        <Pressable style={styles.fotoViewer} onPress={() => setFotoVisualizando(null)}>
          {fotoVisualizando && (
            <Image
              source={{ uri: fotoVisualizando }}
              style={styles.fotoViewerImg}
              resizeMode="contain"
            />
          )}
          <View style={styles.fotoViewerClose}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>✕ Fechar</Text>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: spacing.lg, paddingBottom: 40 },

  anonBanner: {
    backgroundColor: colors.warning + '18',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  anonBannerText: { fontSize: 13, color: colors.warning, lineHeight: 18 },

  avatarPlaceholder: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarRow: { alignItems: 'center', marginBottom: spacing.lg },
  avatarBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarBtnText: { fontSize: 13, color: colors.primary, fontWeight: '500' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  toggleSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.md },

  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  inputMultiline: { height: 100, paddingTop: spacing.sm },
  row2: { flexDirection: 'row' },

  picker: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pickerText: { flex: 1, fontSize: 15, color: colors.text },
  pickerChevron: { fontSize: 20, color: colors.textMuted },

  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Portfólio
  portfolioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  portfolioAddBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    backgroundColor: colors.primary + '15',
    minWidth: 90,
    alignItems: 'center',
  },
  portfolioAddBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  portfolioEmpty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: spacing.lg,
    alignItems: 'center',
  },
  portfolioEmptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  portfolioEmptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  portfolioThumb: {
    width: FOTO_SIZE,
    height: FOTO_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  portfolioThumbImg: { width: '100%', height: '100%' },
  portfolioRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portfolioRemoveBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  portfolioHint: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },

  // Visualizador
  fotoViewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fotoViewerImg: { width: '100%', height: '80%' },
  fotoViewerClose: {
    position: 'absolute',
    top: 52,
    right: spacing.lg,
  },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  pickerHeaderTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  pickerHeaderClose: { fontSize: 15, color: colors.primary },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  pickerItemSelected: { backgroundColor: colors.primary + '10' },
  pickerItemText: { flex: 1, fontSize: 15, color: colors.text },
  pickerItemTextSelected: { color: colors.primary, fontWeight: '600' },
  pickerCheckmark: { fontSize: 16, color: colors.primary, fontWeight: '700' },
});
