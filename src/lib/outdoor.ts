// Palavras-chave que indicam tarefas / materiais em área externa ou
// que dependem de condições climáticas favoráveis.
const OUTDOOR_KEYWORDS = [
  // Áreas
  'varanda', 'terraço', 'terraco', 'quintal', 'jardim', 'garagem',
  'calçada', 'calcada', 'passeio', 'rua', 'patio', 'pátio',
  'cobertura', 'telhado', 'laje', 'marquise',
  'fachada', 'muro', 'mureta', 'cerca', 'portão', 'portao',
  'área externa', 'area externa', 'área descoberta', 'area descoberta',
  'área comum', 'area comum',

  // Serviços externos
  'pintura externa', 'pintura fachada', 'revestimento externo',
  'impermeabilização', 'impermeabilizacao',
  'fundação', 'fundacao', 'escavação', 'escavacao',
  'estrutura', 'pilares', 'vigas',
  'drenagem', 'aterro', 'terraplanagem',
  'calçamento', 'calcamento', 'pavimentação', 'pavimentacao',
  'paisagismo', 'plantio',

  // Materiais que dependem de tempo seco
  'concreto', 'concretagem', 'argamassa', 'reboco',
  'gesso externo', 'massa corrida externa',
  'cimento', 'cura',
];

export function isOutdoor(nome: string, descricao: string | null): boolean {
  const texto = `${nome} ${descricao ?? ''}`.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  return OUTDOOR_KEYWORDS.some(kw => texto.includes(
    kw.normalize('NFD').replace(/[̀-ͯ]/g, '')
  ));
}
