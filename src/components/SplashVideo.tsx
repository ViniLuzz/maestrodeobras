import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as SplashScreen from 'expo-splash-screen';

// Tempo mínimo de vídeo VISÍVEL (conta só depois que o 1º frame aparece).
const MIN_MS = 1800;
// Teto absoluto de segurança (desde a montagem).
const MAX_MS = 8000;

interface Props {
  // true quando a auth terminou de inicializar (dados prontos pra aparecer).
  appReady: boolean;
  // chamado no INÍCIO do fade — pra montar o app por baixo antes de revelar.
  onReveal: () => void;
  // chamado no FIM do fade — pra desmontar a splash.
  onFinish: () => void;
}

/**
 * Splash em vídeo exibida no boot, por cima de tudo. Some quando o vídeo
 * termina E o app está pronto (respeitando um tempo mínimo), com fade suave.
 * Substitui o ActivityIndicator padrão do RootNavigator.
 */
export function SplashVideo({ appReady, onReveal, onFinish }: Props) {
  // videoReady = o 1º frame do vídeo já está disponível (status readyToPlay).
  // Enquanto não, a splash NATIVA (branca) cobre tudo — pra nunca aparecer o
  // retângulo preto da superfície do vídeo carregando.
  const [videoReady, setVideoReady] = useState(false);
  const [minVisibleDone, setMinVisibleDone] = useState(false);
  // exiting = já trocamos o vídeo pelo fundo claro (pra o fade nunca mostrar
  // a superfície preta do vídeo na transição pro app).
  const [exiting, setExiting] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const finishedRef = useRef(false);

  // loop = true: o vídeo nunca chega ao fim → não existe o frame preto final.
  const player = useVideoPlayer(require('../../assets/splash-video.mp4'), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const finish = useRef(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setExiting(true); // remove o vídeo, deixa só o fundo claro
    onReveal();       // monta o app por baixo
    // dá um frame pro fundo claro pintar (vídeo já saiu) antes de iniciar o fade
    setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 60);
  }).current;

  // Só esconde a splash nativa QUANDO o vídeo está pronto pra mostrar o 1º frame
  // (ou em erro). Fallback de 3s pra nunca ficar presa caso o evento não venha.
  useEffect(() => {
    const revelarVideo = () => {
      SplashScreen.hideAsync().catch(() => {});
      setVideoReady(true);
    };
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' || status === 'error') revelarVideo();
    });
    const fallback = setTimeout(revelarVideo, 3000);
    return () => {
      sub.remove();
      clearTimeout(fallback);
    };
  }, [player]);

  // Tempo mínimo de vídeo VISÍVEL — começa a contar só depois que ele aparece.
  useEffect(() => {
    if (!videoReady) return;
    const t = setTimeout(() => setMinVisibleDone(true), MIN_MS);
    return () => clearTimeout(t);
  }, [videoReady]);

  // Teto absoluto de segurança.
  useEffect(() => {
    const tMax = setTimeout(() => finish(), MAX_MS);
    return () => clearTimeout(tMax);
  }, [finish]);

  // Sai quando: o vídeo já apareceu, ficou visível o tempo mínimo, e o app pronto.
  useEffect(() => {
    if (videoReady && minVisibleDone && appReady) finish();
  }, [videoReady, minVisibleDone, appReady, finish]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, { opacity: fade }]}>
      {!exiting && (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          surfaceType="textureView"
          nativeControls={false}
          allowsFullscreen={false}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Fundo claro (#f0f0f0) em toda a tela da splash, emoldurando o vídeo.
  container: { backgroundColor: '#f0f0f0', zIndex: 999, alignItems: 'center', justifyContent: 'center' },
  // Largura cheia + altura reduzida: o cover corta o vazio de cima/baixo (não as
  // laterais da logo). Aumente a altura pra MAIS zoom, diminua pra MENOS.
  video: { width: '100%', height: '80%' },
});
