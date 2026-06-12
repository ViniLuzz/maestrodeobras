// Templates pré-definidos para acelerar criação de tarefas/materiais/especialidades

export const TEMPLATES_ETAPAS = [
  'Demolição',
  'Limpeza do terreno',
  'Escavação',
  'Fundação',
  'Estrutura',
  'Alvenaria',
  'Cobertura',
  'Reboco/Emboço',
  'Piso',
  'Azulejo',
  'Pintura',
  'Portas e janelas',
  'Acabamento',
  'Limpeza final',
];

export const TEMPLATES_MATERIAIS = [
  'Cimento',
  'Areia',
  'Brita',
  'Tijolos/Blocos',
  'Ferro/Aço',
  'Madeira',
  'Tinta',
  'Argamassa',
  'Cal',
  'Vidro',
  'Cerâmica',
  'Azulejos',
  'Telhas',
  'Tubulações',
  'Fios elétricos',
  'Cano PVC',
  'Louças sanitárias',
  'Pisos vinílicos',
];

export const TEMPLATES_ESPECIALIDADES = [
  'Pedreiro',
  'Eletricista',
  'Gesseiro',
  'Pintor',
  'Encanador',
  'Carpinteiro',
  'Azulejos/Revestimentos',
  'Mestre de obras',
  'Servente',
  'Vidraceiro',
  'Cerrajero',
  'Soldador',
  'Térmico',
  'Decorador',
  'Jardineiro',
];

export const TEMPLATES_CONTRATACOES = [
  'Alvenaria',
  'Instalação elétrica',
  'Instalação hidráulica',
  'Cobertura/Telhado',
  'Pintura',
  'Revestimento/Azulejos',
  'Piso/Acabamento',
  'Gesso/Drywall',
  'Estrutura/Armação',
  'Limpeza e preparação',
  'Demolição',
  'Escavação',
  'Impermeabilização',
  'Vidros e espelhos',
  'Portas e janelas',
];

export function sugerir(texto: string, lista: string[]): string[] {
  if (!texto.trim()) return lista;

  const lower = texto.toLowerCase();
  return lista
    .filter(item => item.toLowerCase().includes(lower))
    .sort((a, b) => {
      // Priorizar itens que começam com o texto
      const aStart = a.toLowerCase().startsWith(lower);
      const bStart = b.toLowerCase().startsWith(lower);
      if (aStart && !bStart) return -1;
      if (!aStart && bStart) return 1;
      return 0;
    })
    .slice(0, 8); // Máximo 8 sugestões
}
