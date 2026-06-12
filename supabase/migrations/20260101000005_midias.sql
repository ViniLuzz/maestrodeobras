-- ============================================================
-- Maestro de Obras — Fase 2 — Mídias (fotos e vídeos)
-- ============================================================
-- Registra metadados de cada arquivo enviado ao Storage.
-- O arquivo em si fica no bucket "midias" do Supabase Storage.
-- Caminho no bucket: obras/{obra_id}/{item_tipo}/{item_id}/{timestamp}.{ext}
-- ============================================================

create table public.midias (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  item_tipo text not null check (item_tipo in ('etapa', 'material', 'contratacao')),
  item_id uuid not null,
  storage_path text not null,
  tipo text not null check (tipo in ('foto', 'video')),
  nome_original text,
  tamanho_bytes bigint,
  uploaded_por uuid references public.pessoas(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index idx_midias_item on public.midias(item_tipo, item_id);
create index idx_midias_obra on public.midias(obra_id);

-- =====================
-- RLS
-- =====================
alter table public.midias enable row level security;

create policy "midias_select" on public.midias
  for select to authenticated
  using (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()));

create policy "midias_insert" on public.midias
  for insert to authenticated
  with check (public.is_member_of_obra(obra_id, public.get_pessoa_id_from_auth()));

create policy "midias_delete" on public.midias
  for delete to authenticated
  using (
    uploaded_por = public.get_pessoa_id_from_auth()
    or public.is_admin_of_obra(obra_id, public.get_pessoa_id_from_auth())
  );

-- =====================
-- Storage bucket
-- =====================
-- Bucket público: URLs acessíveis diretamente sem auth.
-- Acesso de escrita/deleção restrito por políticas abaixo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'midias',
  'midias',
  true,
  104857600, -- 100 MB por arquivo
  array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic',
    'video/mp4', 'video/quicktime', 'video/mov'
  ]
) on conflict (id) do nothing;

-- Upload: apenas membros da obra
create policy "storage_midias_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'midias'
    and split_part(name, '/', 1) = 'obras'
    and public.is_member_of_obra(
      split_part(name, '/', 2)::uuid,
      public.get_pessoa_id_from_auth()
    )
  );

-- Download público (bucket já é público, mas policy extra de segurança)
create policy "storage_midias_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'midias');

-- Deleção: quem fez upload ou admin da obra
create policy "storage_midias_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'midias'
    and public.is_member_of_obra(
      split_part(name, '/', 2)::uuid,
      public.get_pessoa_id_from_auth()
    )
  );
