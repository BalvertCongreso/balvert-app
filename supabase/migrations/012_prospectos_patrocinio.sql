-- BALVERT 2027 — Migración: Fase 6c, Captación (embudo de patrocinadores potenciales)
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

create table if not exists prospectos_patrocinio (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid references ediciones(id),
  empresa_entidad text,
  contacto_nombre text,
  contacto_cargo text,
  contacto_email text,
  contacto_telefono text,
  interes text check (interes in ('Sin contactar','Contactado','Interesado','En negociación','No interesado','Convertido en patrocinador')),
  responsable text check (responsable in ('🔴 Ariosto','🟣 Ariadna','🤝 Ambos')),
  observaciones text
);

create table if not exists prospectos_contactos (
  id uuid primary key default gen_random_uuid(),
  prospecto_id uuid references prospectos_patrocinio(id) on delete cascade,
  fecha timestamptz default now(),
  autor text check (autor in ('Ariosto','Ariadna')),
  comentario text
);

alter table prospectos_patrocinio enable row level security;
alter table prospectos_contactos enable row level security;

create policy "solo con sesión prospectos_patrocinio" on prospectos_patrocinio for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión prospectos_contactos" on prospectos_contactos for all using (auth.uid() is not null) with check (auth.uid() is not null);

grant select, insert, update, delete on prospectos_patrocinio to anon, authenticated;
grant select, insert, update, delete on prospectos_contactos to anon, authenticated;
grant select, insert, update, delete on prospectos_patrocinio to service_role;
grant select, insert, update, delete on prospectos_contactos to service_role;
