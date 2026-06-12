import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Detecta conexão em TEMPO REAL via NetInfo (reage no instante em que a rede cai
 * ou volta, não só ao reabrir o app). Mesma API de antes: { isOffline }.
 * `isInternetReachable` pode vir null no começo → não consideramos offline ainda.
 */
export function useNetwork() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const avaliar = (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    };
    NetInfo.fetch().then(avaliar);
    const unsub = NetInfo.addEventListener(avaliar);
    return () => unsub();
  }, []);

  return { isOffline };
}
