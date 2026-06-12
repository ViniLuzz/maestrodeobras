import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { SplashVideo } from '@/components/SplashVideo';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import {
  configurarNotificacoes,
  pedirPermissaoNotificacoes,
  reagendarLembretesDePrazo,
} from '@/lib/notificacoes';
import { iniciarMonitoramento, Sentry } from '@/lib/monitoramento';

// Crash reporting o mais cedo possível (no-op se não houver DSN configurado).
iniciarMonitoramento();

// Impede a splash nativa de sumir sozinha — quem decide é o vídeo (evita flash branco).
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function App() {
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Root />
          <StatusBar style="light" />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

// Envolve o app com o Sentry (error boundary + perf). No-op sem DSN.
export default Sentry.wrap(App);

// Dentro do AuthProvider pra saber quando a inicialização termina (dados prontos).
function Root() {
  const { isInitializing, isCompletingSignIn, pessoa } = useAuth();
  // appMounted: monta a navegação (no início do fade, por baixo da splash).
  // splashGone: remove a splash (no fim do fade).
  const [appMounted, setAppMounted] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const appReady = !isInitializing && !isCompletingSignIn;

  // Onboarding de primeiro uso (null = ainda lendo do storage).
  const [onboardingVisto, setOnboardingVisto] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('onboarding_visto')
      .then(v => setOnboardingVisto(v === '1'))
      .catch(() => setOnboardingVisto(true));
  }, []);
  const concluirOnboarding = () => {
    setOnboardingVisto(true);
    AsyncStorage.setItem('onboarding_visto', '1').catch(() => {});
  };

  // Notificações de prazo: só pra conta real (convidado é vitrine).
  // Pede permissão no 1º login e reagenda os lembretes a partir do banco.
  const notifPronta = useRef(false);
  useEffect(() => {
    if (!pessoa) return;
    (async () => {
      if (!notifPronta.current) {
        notifPronta.current = true;
        await configurarNotificacoes();
        const ok = await pedirPermissaoNotificacoes();
        if (!ok) return;
      }
      reagendarLembretesDePrazo();
    })();
  }, [pessoa?.id]);

  // Reagenda ao voltar pro app (prazos/itens podem ter mudado em outro device).
  useEffect(() => {
    if (!pessoa) return;
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && notifPronta.current) reagendarLembretesDePrazo();
    });
    return () => sub.remove();
  }, [pessoa?.id]);

  // Durante o vídeo, a navegação NÃO monta → thread de JS livre → vídeo liso.
  // Ao terminar: 1) monta o app por baixo (onReveal), 2) fade da splash,
  // 3) remove a splash (onFinish). Sem buraco preto na transição.
  return (
    <>
      {appMounted && <RootNavigator />}
      {/* Onboarding por cima do app, só depois da splash e na 1ª vez. */}
      {splashGone && onboardingVisto === false && (
        <OnboardingScreen onConcluir={concluirOnboarding} />
      )}
      {!splashGone && (
        <SplashVideo
          appReady={appReady}
          onReveal={() => setAppMounted(true)}
          onFinish={() => setSplashGone(true)}
        />
      )}
    </>
  );
}
