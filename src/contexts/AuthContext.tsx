import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Pessoa } from '@/types/database';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  pessoa: Pessoa | null;
  isLoading: boolean;
  isInitializing: boolean;
  isCompletingSignIn: boolean;
  isAnon: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nome: string) => Promise<void>;
  signInWithToken: (token: string, nome: string) => Promise<void>;
  upgradeAccount: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  ativarLicenca: (codigo: string) => Promise<void>;
  refreshPessoa: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  excluirConta: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Para de esperar uma promise que demora demais (ex.: query pendurada durante
// a renovação de token no cold-start). NÃO cancela a request — só rejeita pra
// podermos tentar de novo.
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCompletingSignIn, setIsCompletingSignIn] = useState(false);

  const fetchPessoa = useCallback(async (authUserId: string) => {
    // Tenta até 3x. No cold-start a 1ª query pode pendurar enquanto o token
    // renova; o timeout corta a espera e a tentativa seguinte (já com token
    // renovado) costuma passar. SELECT é idempotente, então repetir é seguro.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('pessoas')
            .select('*')
            .eq('auth_user_id', authUserId)
            .eq('deletado', false)
            .maybeSingle(),
          6000,
        );
        if (error) {
          console.warn(`fetchPessoa erro (tentativa ${attempt})`, error);
        } else {
          return (data as Pessoa | null) ?? null;
        }
      } catch (e) {
        console.warn(`fetchPessoa timeout/falha (tentativa ${attempt})`, e);
      }
      if (attempt < 3) await sleep(800 * attempt);
    }
    return null;
  }, []);

  // Garante que existe um registro de pessoa para o usuário autenticado.
  // Cria automaticamente se não existir, usando os metadados salvos no signup.
  const ensurePessoa = useCallback(async (authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }) => {
    let p = await fetchPessoa(authUser.id);
    if (!p) {
      const meta = authUser.user_metadata ?? {};
      const nome = (meta.nome as string | undefined)
        ?? (meta.full_name as string | undefined)
        ?? authUser.email
        ?? 'Usuário';
      const { error } = await supabase.rpc('criar_pessoa_para_auth', {
        _nome: nome,
        _email: authUser.email ?? null,
      });
      if (!error) {
        p = await fetchPessoa(authUser.id);
      } else {
        console.warn('ensurePessoa rpc error', error);
      }
    }
    return p;
  }, [fetchPessoa]);

  const refreshPessoa = useCallback(async () => {
    if (!user) {
      setPessoa(null);
      return;
    }
    const p = await fetchPessoa(user.id);
    setPessoa(p);
  }, [user, fetchPessoa]);

  useEffect(() => {
    let mounted = true;

    // Timeout de 4s para evitar loading infinito quando a rede está ruim
    // e o Supabase fica pendurado tentando renovar um token expirado.
    const fallback = setTimeout(() => {
      if (mounted) setIsInitializing(false);
    }, 4000);

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        // Sem sessão → entra como CONVIDADO (anônimo) pra ver a vitrine do app.
        // Não cria "pessoa": isso só acontece quando vira conta de verdade.
        try {
          const { data: anon } = await supabase.auth.signInAnonymously();
          if (mounted && anon.session) {
            setSession(anon.session);
            setUser(anon.user);
          }
        } catch {
          // Se falhar, cai no fluxo de login normal.
        }
        clearTimeout(fallback);
        if (mounted) setIsInitializing(false);
        return;
      }
      setSession(data.session);
      setUser(data.session.user ?? null);
      // Só carrega/cria pessoa pra conta REAL — anônimo é só vitrine.
      if (data.session.user && !data.session.user.is_anonymous) {
        const p = await ensurePessoa(data.session.user);
        if (mounted) setPessoa(p);
      }
      clearTimeout(fallback);
      if (mounted) setIsInitializing(false);
    }).catch(() => {
      clearTimeout(fallback);
      if (mounted) setIsInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // O callback roda COM o lock de auth segurado. Chamar supabase.from/rpc
      // aqui (que também precisa do lock) causa deadlock e pendura as queries.
      // Por isso só atualizamos estado síncrono aqui e adiamos as chamadas ao
      // Supabase pra fora do callback com setTimeout(0), liberando o lock.
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // Anônimo (convidado) não tem pessoa — só conta real carrega/cria.
      if (!newSession?.user || newSession.user.is_anonymous) {
        setPessoa(null);
        return;
      }
      const authUser = newSession.user;
      setTimeout(async () => {
        const p = await ensurePessoa(authUser);
        if (mounted) setPessoa(p);
      }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchPessoa]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, nome: string) => {
    setIsLoading(true);
    try {
      // Salva o nome nos metadados para que ensurePessoa possa criar o registro
      // mesmo quando o Supabase exige confirmação de email (session nula no signup).
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nome } },
      });
      if (error) throw error;
      if (data.session) {
        const p = await ensurePessoa(data.session.user);
        setPessoa(p);
      }
    } finally {
      setIsLoading(false);
    }
  }, [ensurePessoa]);

  const signInWithToken = useCallback(async (token: string, nome: string) => {
    setIsLoading(true);
    // Bloqueia a navegação para AppStack até o join terminar
    setIsCompletingSignIn(true);
    try {
      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously({
        options: { data: { nome } },
      });
      if (anonError) throw anonError;
      if (!anonData.user) throw new Error('Erro ao criar sessão');

      // Garante criação da pessoa antes de entrar na obra
      const p = await ensurePessoa({
        id: anonData.user.id,
        user_metadata: { nome },
      });
      if (p) setPessoa(p);

      const { error: joinError } = await supabase.rpc('entrar_na_obra_por_token', { _token: token });
      if (joinError) throw new Error(joinError.message);
    } finally {
      setIsCompletingSignIn(false);
      setIsLoading(false);
    }
  }, [ensurePessoa]);

  const upgradeAccount = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email, password });
      if (error) throw error;
      // Atualiza email na tabela pessoas também
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user.id) {
        await supabase
          .from('pessoas')
          .update({ email })
          .eq('auth_user_id', sessionData.session.user.id);
      }
      await refreshPessoa();
    } finally {
      setIsLoading(false);
    }
  }, [refreshPessoa]);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setPessoa(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const ativarLicenca = useCallback(async (codigo: string) => {
    const { error } = await supabase.rpc('ativar_licenca', { _codigo: codigo });
    if (error) throw error;
    await refreshPessoa();
  }, [refreshPessoa]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) throw error;
  }, []);

  const excluirConta = useCallback(async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('excluir_minha_conta');
      if (error) throw error;
      await supabase.auth.signOut();
      setPessoa(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isAnon = user?.is_anonymous ?? false;

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    pessoa,
    isLoading,
    isInitializing,
    isCompletingSignIn,
    isAnon,
    signIn,
    signUp,
    signInWithToken,
    upgradeAccount,
    signOut,
    ativarLicenca,
    refreshPessoa,
    resetPassword,
    excluirConta,
  }), [user, session, pessoa, isLoading, isInitializing, isCompletingSignIn, isAnon, signIn, signUp, signInWithToken, upgradeAccount, signOut, ativarLicenca, refreshPessoa, resetPassword, excluirConta]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa ser usado dentro de <AuthProvider>');
  return ctx;
}
