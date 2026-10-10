-- BALVERT 2027 — Migración: archivos en la ficha de cada patrocinador
-- (logo, contrato firmado, otros). Solo para el panel interno: nunca se
-- ven en el portal ni salen en las descargas Excel/CSV.
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

create table if not exists patrocinador_archivos (
  id uuid primary key default gen_random_uuid(),
  patrocinador_id uuid not null references patrocinadores(id) on delete cascade,
  tipo text not null check (tipo in ('logo', 'contrato', 'otro')),
  titulo text,
  ruta_archivo text not null unique,
  nombre_archivo text not null,
  autor text,
  creado timestamptz not null default now()
);

create index if not exists patrocinador_archivos_patrocinador
  on patrocinador_archivos (patrocinador_id, creado desc);

-- Solo con la clave de servicio (rutas /api/patrocinadores/*): RLS activado
-- y SIN políticas, igual que documentos (021).
alter table patrocinador_archivos enable row level security;
revoke all on patrocinador_archivos from anon, authenticated;
grant select, insert, update, delete on patrocinador_archivos to service_role;

-- Bucket PRIVADO. Sin políticas en storage.objects: nadie lo lee ni escribe
-- con la clave pública. Subidas con URL firmada de un solo uso y descargas
-- con URL firmada de 60 segundos, ambas creadas por el servidor. Supabase
-- rechaza por sí solo lo que pase de 50 MB o no sea uno de estos tipos
-- (AI y EPS van como application/postscript).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patrocinadores-archivos', 'patrocinadores-archivos', false, 52428800,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp',
              'image/svg+xml', 'application/postscript'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
