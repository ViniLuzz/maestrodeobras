-- ============================================================
-- Seed: Lojas e equipamentos de demonstração
-- Execute após a migration 009.
-- ============================================================

-- Lojas
insert into public.lojas_equipamentos (id, nome, descricao, cidade, estado, telefone, endereco, latitude, longitude)
values
(
  'a1000000-0000-0000-0000-000000000001',
  'LocaFácil Equipamentos',
  'Locadora especializada em equipamentos para construção civil. Atendemos obras residenciais, comerciais e de infraestrutura. Entrega e retirada na obra.',
  'São Paulo', 'SP', '11934560001',
  'Av. das Nações Unidas, 1000 - Pinheiros',
  -23.5645, -46.6550
),
(
  'a1000000-0000-0000-0000-000000000002',
  'ConstruAluga Rio',
  'Locadora com 15 anos de mercado no Rio. Frota própria com manutenção preventiva. Orçamento sem compromisso.',
  'Rio de Janeiro', 'RJ', '21934560002',
  'Rua da Assembleia, 500 - Centro',
  -22.9028, -43.1733
),
(
  'a1000000-0000-0000-0000-000000000003',
  'AlugaObra Itajubá',
  'Locadora local atendendo toda a região do Sul de Minas. Equipamentos modernos e bem conservados.',
  'Itajubá', 'MG', '35934560003',
  'Av. Dr. João Beraldo, 200',
  -22.4328, -45.4528
),
(
  'a1000000-0000-0000-0000-000000000004',
  'MegaLoca Curitiba',
  'Maior frota de equipamentos pesados do Paraná. Plataformas elevatórias, retroescavadeiras e muito mais.',
  'Curitiba', 'PR', '41934560004',
  'Rod. BR-376, km 10 - Industrial',
  -25.4850, -49.2700
),
(
  'a1000000-0000-0000-0000-000000000005',
  'EquipaBH',
  'Locadora de equipamentos leves e pesados em Belo Horizonte. Frota revisada e equipe técnica disponível.',
  'Belo Horizonte', 'MG', '31934560005',
  'Av. Cristiano Machado, 800 - Floresta',
  -19.9120, -43.9390
)
on conflict (id) do nothing;

-- Equipamentos — LocaFácil (SP)
insert into public.equipamentos (loja_id, nome, categoria, descricao, preco_diaria)
values
('a1000000-0000-0000-0000-000000000001', 'Andaime tubular 1m x 2m', 'Andaime', 'Módulo de andaime tubular galvanizado. Aluguel por módulo/dia. Kit com travessa e rodapé.', 8.00),
('a1000000-0000-0000-0000-000000000001', 'Andaime fachadeiro 3m', 'Andaime', 'Andaime de fachada em alumínio, leve e resistente. Capacidade 200kg.', 35.00),
('a1000000-0000-0000-0000-000000000001', 'Betoneira 400L', 'Betoneira', 'Betoneira elétrica 400 litros, motor 2CV trifásico. Ideal para médias obras.', 120.00),
('a1000000-0000-0000-0000-000000000001', 'Betoneira 180L', 'Betoneira', 'Betoneira compacta para pequenas obras e reformas. Motor monofásico 1CV.', 65.00),
('a1000000-0000-0000-0000-000000000001', 'Gerador 5kVA', 'Gerador', 'Gerador a gasolina 5kVA. Ideal para obras sem rede elétrica disponível.', 180.00),
('a1000000-0000-0000-0000-000000000001', 'Compactador de solo', 'Compactador', 'Compactador tipo sapo 70kg. Indispensável para compactação de aterros e sub-bases.', 150.00),
('a1000000-0000-0000-0000-000000000001', 'Cortadora de piso', 'Serra', 'Serra de corte para piso e pastilhas cerâmicas. Disco diamantado incluso.', 90.00);

-- Equipamentos — ConstruAluga (RJ)
insert into public.equipamentos (loja_id, nome, categoria, descricao, preco_diaria)
values
('a1000000-0000-0000-0000-000000000002', 'Britadeira elétrica 10kg', 'Britadeira', 'Britadeira rompedora 10kg para demolição de pisos e paredes de alvenaria.', 95.00),
('a1000000-0000-0000-0000-000000000002', 'Britadeira pneumática', 'Britadeira', 'Britadeira pneumática para uso com compressor. Alta potência de impacto.', 75.00),
('a1000000-0000-0000-0000-000000000002', 'Compressor de ar 100L', 'Compressor', 'Compressor de pistão 100 litros, 2,5HP. Para britadeiras pneumáticas e pintura a pistola.', 130.00),
('a1000000-0000-0000-0000-000000000002', 'Andaime tubular 1m x 2m', 'Andaime', 'Módulo de andaime tubular. Disponibilidade de grandes quantidades.', 9.00),
('a1000000-0000-0000-0000-000000000002', 'Plataforma elevatória 8m', 'Plataforma Elevatória', 'Plataforma elevatória articulada, alcance 8m. Elétrica, para uso em ambientes fechados.', 450.00),
('a1000000-0000-0000-0000-000000000002', 'Vibrador de concreto', 'Vibrador', 'Vibrador de imersão para adensamento de concreto. Mangote 38mm.', 80.00);

-- Equipamentos — AlugaObra Itajubá (MG)
insert into public.equipamentos (loja_id, nome, categoria, descricao, preco_diaria)
values
('a1000000-0000-0000-0000-000000000003', 'Betoneira 400L', 'Betoneira', 'Betoneira elétrica 400L disponível para obras na região de Itajubá.', 110.00),
('a1000000-0000-0000-0000-000000000003', 'Betoneira 180L', 'Betoneira', 'Betoneira compacta para reformas e pequenas obras.', 60.00),
('a1000000-0000-0000-0000-000000000003', 'Andaime tubular 1m x 2m', 'Andaime', 'Módulos de andaime tubular. Entrega na região de Itajubá e cidades vizinhas.', 8.50),
('a1000000-0000-0000-0000-000000000003', 'Compactador de solo', 'Compactador', 'Compactador tipo sapo para aterros e sub-bases.', 140.00),
('a1000000-0000-0000-0000-000000000003', 'Gerador 3kVA', 'Gerador', 'Gerador compacto para obras sem energia. Combustão a gasolina.', 130.00),
('a1000000-0000-0000-0000-000000000003', 'Cortadora de piso', 'Serra', 'Serra de corte para cerâmica e pedras. Disco incluso.', 80.00);

-- Equipamentos — MegaLoca Curitiba (PR)
insert into public.equipamentos (loja_id, nome, categoria, descricao, preco_diaria)
values
('a1000000-0000-0000-0000-000000000004', 'Plataforma elevatória 12m', 'Plataforma Elevatória', 'Plataforma articulada 12m de altura, diesel. Para obras externas e galpões.', 780.00),
('a1000000-0000-0000-0000-000000000004', 'Plataforma elevatória 8m', 'Plataforma Elevatória', 'Plataforma 8m elétrica para uso interno. Homologada ABNT.', 480.00),
('a1000000-0000-0000-0000-000000000004', 'Compressor de ar 200L', 'Compressor', 'Compressor industrial 200 litros, 5HP. Para múltiplas ferramentas simultâneas.', 200.00),
('a1000000-0000-0000-0000-000000000004', 'Gerador 15kVA', 'Gerador', 'Gerador a diesel 15kVA para obras de médio porte sem rede.', 380.00),
('a1000000-0000-0000-0000-000000000004', 'Vibrador de concreto', 'Vibrador', 'Vibrador de imersão profissional, mangotes 38mm e 57mm.', 85.00),
('a1000000-0000-0000-0000-000000000004', 'Bomba de concreto', 'Bomba', 'Bomba de concreto estacionária, vazão 30m³/h. Para lajes e estruturas complexas.', 1200.00);

-- Equipamentos — EquipaBH (MG)
insert into public.equipamentos (loja_id, nome, categoria, descricao, preco_diaria)
values
('a1000000-0000-0000-0000-000000000005', 'Britadeira elétrica 10kg', 'Britadeira', 'Rompedora para demolição. Motor de 1600W, 45 golpes/s.', 90.00),
('a1000000-0000-0000-0000-000000000005', 'Compactador de solo', 'Compactador', 'Compactador sapo para bases e aterros. Peso 68kg.', 145.00),
('a1000000-0000-0000-0000-000000000005', 'Betoneira 400L', 'Betoneira', 'Betoneira 400L trifásica. Entrega em BH e região metropolitana.', 115.00),
('a1000000-0000-0000-0000-000000000005', 'Andaime tubular 1m x 2m', 'Andaime', 'Módulos tubulares para fachada e interior. Grande disponibilidade.', 8.00),
('a1000000-0000-0000-0000-000000000005', 'Gerador 5kVA', 'Gerador', 'Gerador compacto 5kVA a gasolina. Silencioso e confiável.', 170.00),
('a1000000-0000-0000-0000-000000000005', 'Compressor de ar 100L', 'Compressor', 'Compressor 100L, monofásico. Para ferramentas pneumáticas em geral.', 120.00);
