import AsyncStorage from '@react-native-async-storage/async-storage';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const AS_TIMEOUT = 1500; // AsyncStorage pode travar com New Architecture

function withTimeout<T>(p: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>(r => setTimeout(() => r(fallback), AS_TIMEOUT))]);
}

export async function saveCache<T>(key: string, data: T): Promise<void> {
  try {
    await withTimeout(
      AsyncStorage.setItem(`offline:${key}`, JSON.stringify({ data, ts: Date.now() })),
      undefined as unknown as void,
    );
  } catch {}
}

export async function loadCache<T>(key: string, ttlMs = TTL_MS): Promise<T | null> {
  try {
    const raw = await withTimeout(AsyncStorage.getItem(`offline:${key}`), null);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number };
    if (Date.now() - ts > ttlMs) return null;
    return data as T;
  } catch {
    return null;
  }
}
