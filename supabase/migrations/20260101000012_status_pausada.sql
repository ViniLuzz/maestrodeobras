-- Adiciona 'pausada' aos enums de status de etapa, material e contratação.
-- Permite registrar que uma tarefa foi interrompida (ex: condições climáticas).

alter type public.etapa_status      add value if not exists 'pausada';
alter type public.material_status   add value if not exists 'pausada';
alter type public.contratacao_status add value if not exists 'pausada';
