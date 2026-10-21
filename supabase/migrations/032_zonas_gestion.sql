-- BALVERT 2027 — Migración: pantallas «Zona de patrocinadores» y «Zona de
-- clientes» del panel. Ejecutar en Supabase SQL Editor. Se puede ejecutar
-- más de una vez sin romper nada.

-- 1) Último acceso de cada cliente a su zona personal (por email). Las
--    sesiones del portal se borran al caducar, así que se guarda aparte.
--    Solo la clave de servicio, como el resto de tablas del portal.
create table if not exists clientes_accesos (
  email text primary key,
  ultimo_acceso timestamptz not null default now()
);
alter table clientes_accesos enable row level security;
revoke all on clientes_accesos from anon, authenticated;
grant select, insert, update, delete on clientes_accesos to service_role;

-- 2) Material que sube la empresa: cuándo lo revisó la organización (vacío =
--    «nuevo, sin revisar» en la Zona de patrocinadores).
alter table patrocinador_archivos add column if not exists revisado_en timestamptz;

notify pgrst, 'reload schema';
