import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/lib/theme';

type Slide = { emoji: string; titulo: string; texto: string };

const SLIDES: Slide[] = [
  {
    emoji: '🏗️',
    titulo: 'Toda a obra na palma da mão',
    texto: 'Crie obras e organize etapas, materiais e contratações num só lugar — do começo ao fim.',
  },
  {
    emoji: '⏰',
    titulo: 'Nunca perca um prazo',
    texto: 'Cronograma com lembretes automáticos. A gente te avisa antes de cada prazo vencer.',
  },
  {
    emoji: '📄',
    titulo: 'Relatórios que impressionam',
    texto: 'Diário de obra (RDO) e relatório executivo em PDF, prontos pra enviar ao seu cliente.',
  },
];

export function OnboardingScreen({ onConcluir }: { onConcluir: () => void }) {
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const ultimo = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <Pressable style={styles.pular} onPress={onConcluir} hitSlop={10}>
        <Text style={styles.pularText}>{ultimo ? '' : 'Pular'}</Text>
      </Pressable>

      <View style={styles.conteudo}>
        <Text style={styles.emoji}>{slide.emoji}</Text>
        <Text style={styles.titulo}>{slide.titulo}</Text>
        <Text style={styles.texto}>{slide.texto}</Text>
      </View>

      <View style={styles.rodape}>
        <View style={styles.dots}>
          {SLIDES.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === i && styles.dotAtivo]} />
          ))}
        </View>
        <Pressable
          style={styles.botao}
          onPress={() => (ultimo ? onConcluir() : setI(i + 1))}
        >
          <Text style={styles.botaoText}>{ultimo ? 'Começar' : 'Próximo'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    zIndex: 500,
  },
  pular: { alignSelf: 'flex-end', minHeight: 24 },
  pularText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
  conteudo: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emoji: { fontSize: 96, marginBottom: spacing.sm },
  titulo: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center' },
  texto: { fontSize: 16, color: 'rgba(255,255,255,0.82)', textAlign: 'center', lineHeight: 24, paddingHorizontal: spacing.sm },
  rodape: { gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotAtivo: { backgroundColor: colors.primary, width: 22 },
  botao: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  botaoText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
