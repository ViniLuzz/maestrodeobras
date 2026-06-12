// Tipos manuais espelhando o schema.
// Quando o Supabase CLI estiver configurado, regenerar via:
//   supabase gen types typescript --linked > src/types/database.ts

// =====================
// Fase 1
// =====================
export type AppRole = 'admin';
export type ObraRole = 'admin' | 'trabalhador';
export type ObraStatus = 'em_andamento' | 'concluida' | 'pausada' | 'cancelada';

export interface Pessoa {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cor: string;
  is_admin: boolean;
  auth_user_id: string | null;
  ativo: boolean;
  ultimo_acesso: string | null;
  plano_ativo: boolean;
  plano_expira_em: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  notificacoes_ativas: boolean;
  notificacao_2_dias: boolean;
  notificacao_3_dias: boolean;
  push_token: string | null;
  onesignal_player_id: string | null;
  // Marketplace
  disponivel_marketplace: boolean;
  especialidade: string | null;
  descricao_marketplace: string | null;
  cidade: string | null;
  estado: string | null;
  avatar_url: string | null;
  latitude: number | null;
  longitude: number | null;
  deletado: boolean;
  deletado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type RdoClima = 'bom' | 'nublado' | 'chuva';
export type RdoCondicao = 'trabalhou' | 'parou';
export interface RdoExterno {
  nome: string;
  funcao?: string | null;
}
export interface RdoItem {
  tipo: 'etapa' | 'material' | 'contratacao';
  id: string;
  nome: string;
  descricao?: string | null;
}
export interface Rdo {
  id: string;
  obra_id: string;
  data: string;
  clima: RdoClima | null;
  condicao: RdoCondicao | null;
  membros_presentes: string[];
  externos: RdoExterno[];
  itens: RdoItem[];
  fotos: string[];
  atividades: string | null;
  ocorrencias: string | null;
  criado_por: string | null;
  deletado: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Obra {
  id: string;
  nome: string;
  descricao: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  data_inicio: string | null;
  data_previsao_termino: string | null;
  data_termino_real: string | null;
  status: ObraStatus;
  admin_id: string;
  token_convite: string | null;
  deletado: boolean;
  deletado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ObraMembro {
  id: string;
  obra_id: string;
  pessoa_id: string;
  role: ObraRole;
  token_acesso: string | null;
  ativo: boolean;
  expira_em: string | null;
  convidado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ObraMembroComPessoa extends ObraMembro {
  pessoa: Pick<Pessoa, 'id' | 'nome' | 'email' | 'telefone' | 'cor'>;
}

export interface Licenca {
  id: string;
  codigo_ativacao: string;
  email_comprador: string | null;
  stripe_payment_id: string | null;
  usado: boolean;
  usado_por: string | null;
  usado_em: string | null;
  expira_em: string | null;
  criado_em: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  criado_em: string;
}

export type MidiaTipo = 'foto' | 'video';
export type MidiaItemTipo = 'etapa' | 'material' | 'contratacao';

export interface Midia {
  id: string;
  obra_id: string;
  item_tipo: MidiaItemTipo;
  item_id: string;
  storage_path: string;
  tipo: MidiaTipo;
  nome_original: string | null;
  tamanho_bytes: number | null;
  uploaded_por: string | null;
  criado_em: string;
}

// =====================
// Fase 2
// =====================
export type EtapaStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada' | 'pausada';
export type MaterialStatus = 'pendente' | 'entregue' | 'faltando' | 'cancelado' | 'pausada';
export type ContratacaoStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada' | 'pausada';

export interface Etapa {
  id: string;
  obra_id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  status: EtapaStatus;
  responsavel_id: string | null;
  data_inicio: string | null;
  data_previsao_fim: string | null;
  data_conclusao: string | null;
  // Novos campos para gestão de equipe
  pessoa_id: string | null;
  concluida: boolean;
  data_conclusao_real: string | null;
  deletado: boolean;
  deletado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface EtapaDependencia {
  id: string;
  etapa_id: string;
  depende_de_id: string;
  criado_em: string;
}

export interface Material {
  id: string;
  obra_id: string;
  etapa_id: string | null;
  nome: string;
  descricao: string | null;
  quantidade: number | null;
  unidade: string | null;
  status: MaterialStatus;
  responsavel_id: string | null;
  data_previsao: string | null;
  data_conclusao: string | null;
  obs: string | null;
  // Novos campos para gestão de equipe
  pessoa_id: string | null;
  recebido: boolean;
  data_recebimento_real: string | null;
  deletado: boolean;
  deletado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Contratacao {
  id: string;
  obra_id: string;
  etapa_id: string | null;
  nome: string;
  descricao: string | null;
  especialidade: string | null;
  pessoa_nome: string | null;
  pessoa_contato: string | null;
  status: ContratacaoStatus;
  data_inicio: string | null;
  data_previsao_fim: string | null;
  data_conclusao: string | null;
  valor: number | null;
  obs: string | null;
  // Novos campos para gestão de equipe e financeiro
  pessoa_id: string | null;
  iniciada: boolean;
  data_inicio_real: string | null;
  data_conclusao_real: string | null;
  valor_acordado: number | null;
  valor_pago: number | null;
  deletado: boolean;
  deletado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

// =====================
// Aluguel de Equipamentos
// =====================
export interface LojaEquipamento {
  id: string;
  nome: string;
  descricao: string | null;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  endereco: string | null;
  avatar_url: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean;
  deletado: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Equipamento {
  id: string;
  loja_id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  foto_url: string | null;
  preco_diaria: number | null;
  ativo: boolean;
  deletado: boolean;
  criado_em: string;
}

// =====================
// Gestão de Equipe e Financeiro
// =====================
export type DespesaCategoria = 'material' | 'mao_obra' | 'aluguel' | 'servicos' | 'outro';
export type DespesaVinculada = 'material' | 'contratacao' | 'nenhum';

export interface Despesa {
  id: string;
  obra_id: string;
  categoria: DespesaCategoria;
  descricao: string;
  valor: number;
  data: string;
  registrado_por: string;
  vinculado_a: DespesaVinculada;
  vinculado_id: string | null;
  deletado: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface OrcamentoObra {
  id: string;
  obra_id: string;
  orcamento_total: number;
  orcamento_materiais: number | null;
  orcamento_mao_obra: number | null;
  orcamento_aluguel: number | null;
  orcamento_servicos: number | null;
  criado_em: string;
  atualizado_em: string;
}

export type TemplateTipo = 'etapa' | 'material' | 'especialidade' | 'contratacao';

export interface TemplateSugestao {
  id: string;
  tipo: TemplateTipo;
  texto: string;
  usos: number; // Contador de quantas vezes foi usado
  registrado_por: string | null;
  criado_em: string;
}
