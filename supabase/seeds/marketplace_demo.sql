-- ============================================================
-- Seed: Perfis de demonstração para o Marketplace
-- Execute no SQL Editor do Supabase após as migrations 007 e 008.
-- ============================================================

insert into public.pessoas (
  nome, email, telefone, cor,
  disponivel_marketplace, especialidade, descricao_marketplace, cidade, estado,
  latitude, longitude,
  auth_user_id, ativo, is_admin
) values
(
  'João Ferreira', 'joao.eletricista@email.com', '11991234567', '#f59e0b',
  true, 'Eletricista',
  'Eletricista com 12 anos de experiência em instalações residenciais e comerciais. Especialista em quadros de distribuição, SPDA (para-raios) e automação residencial. Trabalho com NR-10 atualizada.',
  'São Paulo', 'SP', -23.5505, -46.6333,
  null, true, false
),
(
  'Carlos Mendes', 'carlos.pedreiro@email.com', '21987654321', '#10b981',
  true, 'Pedreiro',
  'Pedreiro e assentador com 18 anos de experiência. Executo alvenaria estrutural, revestimentos, contrapiso e serviços de acabamento fino. Pontualidade e qualidade garantidas.',
  'Rio de Janeiro', 'RJ', -22.9068, -43.1729,
  null, true, false
),
(
  'André Souza', 'andre.encanador@email.com', '31996543210', '#3b82f6',
  true, 'Encanador / Hidráulico',
  'Especializado em instalações hidráulicas residenciais, detecção e reparo de vazamentos, e instalação de aquecedores a gás e elétricos. Atendo emergências.',
  'Belo Horizonte', 'MG', -19.9167, -43.9345,
  null, true, false
),
(
  'Marcos Pinturas', 'marcos.pintor@email.com', '41993214567', '#8b5cf6',
  true, 'Pintor',
  'Pintor profissional com foco em acabamento de alta qualidade. Executo pintura interna e externa, textura, grafiato e pintura epóxi para pisos. Material incluso ou por conta do cliente.',
  'Curitiba', 'PR', -25.4284, -49.2733,
  null, true, false
),
(
  'Roberto Gomes', 'roberto.mestre@email.com', '11997896543', '#ef4444',
  true, 'Mestre de obras',
  'Mestre de obras com 20 anos no mercado. Coordeno equipes, controlo cronograma e orçamento, e garanto a qualidade na execução. Experiência em obras residenciais, comerciais e reformas completas.',
  'São Paulo', 'SP', -23.5505, -46.6333,
  null, true, false
),
(
  'Paulo Gesseiro', 'paulo.gesso@email.com', '19994567890', '#06b6d4',
  true, 'Gesseiro',
  'Especialista em forro de gesso acartonado (drywall), gesso liso e molduras decorativas. Executo projetos de teto rebaixado com iluminação embutida. Trabalhos residenciais e comerciais.',
  'Campinas', 'SP', -22.9056, -47.0608,
  null, true, false
),
(
  'Fábio Marcenaria', 'fabio.marceneiro@email.com', '47991238765', '#d97706',
  true, 'Marceneiro',
  'Marceneiro com oficina própria. Fabrico e instalo móveis planejados, armários embutidos, cozinhas e decks de madeira. Uso madeiras certificadas e acabamentos de alta durabilidade.',
  'Joinville', 'SC', -26.3045, -48.8488,
  null, true, false
),
(
  'Sandro Azulejo', 'sandro.azulejo@email.com', '11992345678', '#84cc16',
  true, 'Azulejista',
  'Assentamento de azulejos, porcelanatos e pedras naturais com 15 anos de experiência. Trabalho com juntas perfeitas, alinhamento laser e rejuntes coloridos. Especialidade em áreas molhadas e fachadas.',
  'Santo André', 'SP', -23.6639, -46.5383,
  null, true, false
)
on conflict do nothing;

-- Atualiza coordenadas em perfis já inseridos sem coordenadas (re-run seguro)
update public.pessoas set latitude = -23.5505, longitude = -46.6333
  where email = 'joao.eletricista@email.com' and latitude is null;
update public.pessoas set latitude = -22.9068, longitude = -43.1729
  where email = 'carlos.pedreiro@email.com' and latitude is null;
update public.pessoas set latitude = -19.9167, longitude = -43.9345
  where email = 'andre.encanador@email.com' and latitude is null;
update public.pessoas set latitude = -25.4284, longitude = -49.2733
  where email = 'marcos.pintor@email.com' and latitude is null;
update public.pessoas set latitude = -23.5505, longitude = -46.6333
  where email = 'roberto.mestre@email.com' and latitude is null;
update public.pessoas set latitude = -22.9056, longitude = -47.0608
  where email = 'paulo.gesso@email.com' and latitude is null;
update public.pessoas set latitude = -26.3045, longitude = -48.8488
  where email = 'fabio.marceneiro@email.com' and latitude is null;
update public.pessoas set latitude = -23.6639, longitude = -46.5383
  where email = 'sandro.azulejo@email.com' and latitude is null;
