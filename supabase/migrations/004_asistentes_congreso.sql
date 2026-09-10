-- BALVERT 2027 — Migración: Fase 2A, tabla asistentes_congreso
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

create table if not exists asistentes_congreso (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid references ediciones(id),
  nombre text,
  email text,
  telefono text,
  cargo text,
  empresa_entidad uuid references patrocinadores(id) on delete set null,
  categoria_patrocinio text,
  tipo_acceso text check (tipo_acceso in ('Independiente','Invitado por patrocinio','Contacto de empresa patrocinadora')),
  menu text check (menu in ('Carne','Pescado','Vegetariano','Vegano')),
  alergias_intolerancias text,
  confirmado text check (confirmado in ('Sí','No','Pendiente')),
  entrada_enviada text check (entrada_enviada in ('Sí','No')),
  precio numeric(10,2),
  metodo_pago text check (metodo_pago in ('Transferencia','Pasarela online','Otro')),
  referencia_pago_online text,
  observaciones text
);

alter table asistentes_congreso enable row level security;
create policy "acceso completo asistentes_congreso" on asistentes_congreso for all using (true) with check (true);
grant select, insert, update, delete on asistentes_congreso to anon, authenticated;
