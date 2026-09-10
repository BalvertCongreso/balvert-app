-- BALVERT 2027 — Migración: multi-edición
-- Ejecutar en Supabase SQL Editor (proyecto ya existente, con datos).
-- Añade la tabla ediciones y el campo edicion_id a las tablas de participación,
-- crea la primera edición "BALVERT 2027" y la marca como activa.

create table if not exists ediciones (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  anio integer,
  fecha_inicio date,
  fecha_fin date,
  ciudad text,
  activa boolean not null default false
);

alter table patrocinadores add column if not exists edicion_id uuid references ediciones(id);
alter table gala add column if not exists edicion_id uuid references ediciones(id);
alter table excursion add column if not exists edicion_id uuid references ediciones(id);
alter table tareas add column if not exists edicion_id uuid references ediciones(id);

alter table ediciones enable row level security;
create policy "acceso completo ediciones" on ediciones for all using (true) with check (true);
grant select, insert, update, delete on ediciones to anon, authenticated;

insert into ediciones (nombre, anio, activa)
select 'BALVERT 2027', 2027, true
where not exists (select 1 from ediciones);

-- Por si ya hubiera datos de prueba sin edición asignada, los liga a la
-- primera edición para no perderlos (en este momento las tablas están vacías).
update patrocinadores set edicion_id = (select id from ediciones where activa = true limit 1) where edicion_id is null;
update gala set edicion_id = (select id from ediciones where activa = true limit 1) where edicion_id is null;
update excursion set edicion_id = (select id from ediciones where activa = true limit 1) where edicion_id is null;
update tareas set edicion_id = (select id from ediciones where activa = true limit 1) where edicion_id is null;
