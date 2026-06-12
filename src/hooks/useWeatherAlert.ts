import { useCallback, useRef, useState } from 'react';
import { getWeather } from '@/lib/weather';
import { isOutdoor } from '@/lib/outdoor';

type Result = 'proceed' | 'blocked';

export function useWeatherAlert() {
  const [visible, setVisible] = useState(false);
  const [climaDesc, setClimaDesc] = useState('');
  const [taskName, setTaskName] = useState('');
  const resolveRef = useRef<((r: Result) => void) | null>(null);

  // Retorna Promise que resolve com 'proceed' ou 'blocked'.
  // Se a tarefa não for outdoor ou não estiver chovendo, resolve imediatamente com 'proceed'.
  // Caso contrário, mostra o modal e aguarda a escolha do usuário.
  const checkAndPrompt = useCallback(async (
    nome: string,
    descricao: string | null,
  ): Promise<Result> => {
    if (!isOutdoor(nome, descricao)) return 'proceed';

    const clima = await getWeather();
    if (!clima?.isRaining) return 'proceed';

    setTaskName(nome);
    setClimaDesc(clima.description);
    setVisible(true);

    return new Promise<Result>(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  const onConfirm = useCallback(() => {
    setVisible(false);
    resolveRef.current?.('proceed');
  }, []);

  const onBlock = useCallback(() => {
    setVisible(false);
    resolveRef.current?.('blocked');
  }, []);

  return { checkAndPrompt, visible, climaDesc, taskName, onConfirm, onBlock };
}
