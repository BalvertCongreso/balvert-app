-- BALVERT 2027 — Migración: Fase 4, contactos para newsletter
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

-- Sin edicion_id a propósito: es una lista general (ponentes, prensa,
-- interesados...) que no está ligada a un patrocinador ni a una edición
-- concreta del congreso, tal como describe el brief.
create table if not exists contactos_newsletter (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  apellidos text,
  email text unique,
  telefono text,
  origen_lista text,
  fecha_alta timestamptz default now()
);

alter table contactos_newsletter enable row level security;
create policy "solo con sesión contactos_newsletter" on contactos_newsletter for all using (auth.uid() is not null) with check (auth.uid() is not null);

grant select, insert, update, delete on contactos_newsletter to anon, authenticated;
grant select, insert, update, delete on contactos_newsletter to service_role;
