-- BALVERT 2027 — Migración: portal de clientes (hito 2). Documentos,
-- recibo de pago de Stripe y solicitudes de factura.
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

-- 1) Documentos que Ariadna/Ariosto suben desde la pantalla interna
--    "Documentos" y que se ven en el portal según el destino.
create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid references ediciones(id),
  titulo text not null,
  descripcion text,
  ruta_archivo text not null,
  nombre_archivo text not null,
  destino text not null check (destino in ('todos_asistentes', 'todos_patrocinadores', 'patrocinador')),
  patrocinador_id uuid references patrocinadores(id) on delete cascade,
  creado timestamptz not null default now(),
  check ((destino = 'patrocinador') = (patrocinador_id is not null))
);

-- Solo con la clave de servicio (rutas /api/documentos y /api/portal/*):
-- RLS activado y SIN políticas, igual que portal_enlaces (ver 020).
alter table documentos enable row level security;
revoke all on documentos from anon, authenticated;
grant select, insert, update, delete on documentos to service_role;

-- 2) Bucket PRIVADO para los archivos. Sin políticas en storage.objects para
--    este bucket: nadie lo lee ni escribe con la clave pública. Las subidas
--    usan una URL firmada de un solo uso que crea el servidor, y las
--    descargas una URL firmada de 60 segundos. Supabase rechaza por sí solo
--    lo que no sea PDF/imagen o pase de 20 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 20971520,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3) Enlace al recibo que genera Stripe para cada cobro. Lo guarda el webhook
--    en las entradas compradas online; el portal lo muestra como
--    "Ver recibo del pago".
alter table asistentes_congreso add column if not exists recibo_url text;
alter table gala add column if not exists recibo_url text;
alter table excursion add column if not exists recibo_url text;

-- 4) Solicitudes de factura desde el portal: una por compra (referencia de
--    pago de Stripe). Al pedirla se crea una tarea para Ariadna con los
--    datos fiscales y lo comprado; la factura se hace a mano en Holded.
create table if not exists solicitudes_factura (
  id uuid primary key default gen_random_uuid(),
  creado timestamptz not null default now(),
  email text not null,
  referencia_pago_online text not null unique,
  datos_facturacion jsonb not null,
  tarea_id uuid references tareas(id) on delete set null
);
alter table solicitudes_factura enable row level security;
revoke all on solicitudes_factura from anon, authenticated;
grant select, insert, update, delete on solicitudes_factura to service_role;
