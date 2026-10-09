-- BALVERT 2027 — Migración: portal de clientes (asistentes y patrocinadores).
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).
--
-- El portal NO usa Supabase Auth: las políticas RLS del resto de tablas dejan
-- hacer todo a cualquier sesión de Supabase, así que una persona externa con
-- sesión de Supabase vería la base de datos entera. El portal tiene su propio
-- sistema (enlace por email + cookie) y estas dos tablas solo se tocan desde
-- las rutas /api/portal/* con la clave de servicio.
--
-- En ninguna de las dos se guarda el token en claro: solo su hash SHA-256.
-- Quien leyera estas tablas no podría usar los enlaces ni las sesiones.

-- 1) Enlaces de acceso: un solo uso, caducan a los 15 minutos. También
--    sirven para limitar envíos (pocos por email y hora).
create table if not exists portal_enlaces (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null,
  usado_en timestamptz
);
create index if not exists portal_enlaces_email_creado on portal_enlaces (email, creado_en);

-- 2) Sesiones del portal: 7 días. El email es el verificado con el enlace;
--    todas las lecturas del portal filtran por él.
create table if not exists portal_sesiones (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null
);

-- Solo accesible con la clave de servicio: RLS activado y SIN políticas,
-- igual que compras_pendientes (ver 018).
alter table portal_enlaces enable row level security;
alter table portal_sesiones enable row level security;
revoke all on portal_enlaces from anon, authenticated;
revoke all on portal_sesiones from anon, authenticated;
grant select, insert, update, delete on portal_enlaces to service_role;
grant select, insert, update, delete on portal_sesiones to service_role;
