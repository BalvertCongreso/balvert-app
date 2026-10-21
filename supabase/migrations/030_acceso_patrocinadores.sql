-- BALVERT 2027 — Migración: acceso de las empresas patrocinadoras con
-- usuario y contraseña (zona de empresa del portal). NO usa Supabase Auth:
-- las políticas RLS del resto de tablas dan acceso total a cualquier sesión
-- de Supabase. Igual que el portal de asistentes (020): tablas con RLS
-- activado y SIN políticas, solo la clave de servicio (rutas /api/*).
-- Ejecutar en Supabase SQL Editor. Se puede ejecutar más de una vez.

-- 1) Un acceso por empresa. Solo el hash de la contraseña (scrypt con sal,
--    formato "scrypt$N$r$p$sal$hash"); la contraseña en claro no se guarda
--    nunca. Sin trigger de historial: el hash no debe acabar en ningún sitio.
create table if not exists patrocinador_accesos (
  id uuid primary key default gen_random_uuid(),
  patrocinador_id uuid not null unique references patrocinadores(id) on delete cascade,
  usuario text not null unique check (usuario ~ '^[a-z0-9]{3,40}$'),
  hash_contrasena text not null,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  ultimo_acceso timestamptz
);

-- 2) Sesiones de la zona de empresa (cookie propia, distinta de la de
--    asistente). Se guarda el sha256 del token, nunca el token.
create table if not exists patrocinador_sesiones (
  id uuid primary key default gen_random_uuid(),
  patrocinador_id uuid not null references patrocinadores(id) on delete cascade,
  token_hash text not null unique,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null
);
create index if not exists patrocinador_sesiones_patrocinador on patrocinador_sesiones (patrocinador_id);

-- 3) Intentos fallidos de entrar o de cambiar la contraseña, por usuario
--    escrito ("usuario:x") y por IP ("ip:x"), para el bloqueo temporal.
create table if not exists patrocinador_login_fallos (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  creado timestamptz not null default now()
);
create index if not exists patrocinador_login_fallos_clave on patrocinador_login_fallos (clave, creado desc);

alter table patrocinador_accesos enable row level security;
alter table patrocinador_sesiones enable row level security;
alter table patrocinador_login_fallos enable row level security;
revoke all on patrocinador_accesos from anon, authenticated;
revoke all on patrocinador_sesiones from anon, authenticated;
revoke all on patrocinador_login_fallos from anon, authenticated;
grant select, insert, update, delete on patrocinador_accesos to service_role;
grant select, insert, update, delete on patrocinador_sesiones to service_role;
grant select, insert, delete on patrocinador_login_fallos to service_role;

notify pgrst, 'reload schema';
