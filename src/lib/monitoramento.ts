import * as Sentry from '@sentry/react-native';

// DSN do projeto Sentry. Fica no .env (EXPO_PUBLIC_SENTRY_DSN). Sem DSN, o
// monitoramento é desligado — então em dev/local nada é enviado.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const monitoramentoAtivo = !!DSN;

/** Inicializa o crash reporting. Chamar o mais cedo possível no boot. */
export function iniciarMonitoramento() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    // Amostra de performance (mantém baixo pra não gastar cota à toa).
    tracesSampleRate: 0.2,
    // Em desenvolvimento não envia (evita poluir o Sentry com erros locais).
    enabled: !__DEV__,
  });
}

export { Sentry };
