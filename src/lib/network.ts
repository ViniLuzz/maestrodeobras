const PING = 'https://clients3.google.com/generate_204';

export async function requireOnline(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(PING, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(t);
    if (r.status !== 204 && !r.ok) throw new Error('offline');
  } catch {
    throw new Error('Sem conexão com a internet. Verifique sua rede e tente novamente.');
  }
}
