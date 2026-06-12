import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  AtivarLicenca: undefined;
  AcessoToken: { token?: string } | undefined;
};

export type TabParamList = {
  Obras: undefined;
  Marketplace: undefined;
  Equipamentos: undefined;
  Conta: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList>;
  CriarObra: undefined;
  ObraDetalhe: { obraId: string; obraNome: string };
  ProgressoEquipe: { obraId: string; obraNome: string };
  Financeiro: { obraId: string; obraNome: string };
  RegistrarDespesa: { obraId: string; obraNome: string };
  EditarPerfil: undefined;
  Etapas: { obraId: string };
  EtapaForm: { obraId: string; etapaId?: string };
  Materiais: { obraId: string };
  MaterialForm: { obraId: string; materialId?: string };
  Contratacoes: { obraId: string };
  ContratacaoForm: { obraId: string; contratacaoId?: string };
  AdministracaoObra: { obraId: string };
  Concluidos: { obraId: string };
  Midias: { obraId: string; itemTipo: 'etapa' | 'material' | 'contratacao'; itemId: string; itemNome: string };
  MeuPerfilMarketplace: undefined;
  RelatorioObra: { obraId: string; obraNome: string };
  DiarioObra: { obraId: string; obraNome: string };
};

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, T>;
export type AppScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<AppStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<AppStackParamList>
>;
