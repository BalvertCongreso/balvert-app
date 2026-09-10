-- BALVERT 2027 — Migración: Fase 1B, tabla proveedores
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid references ediciones(id),

  -- Identificación y contacto
  nombre_proveedor text,
  servicio_prestado text,
  persona_contacto text,
  email_contacto text,
  telefono_contacto text,

  -- Evento
  evento_vinculado text check (evento_vinculado in ('Congreso','Gala','Excursión','General/Todo el evento')),

  -- Coste y facturación
  coste_acordado numeric(10,2),
  coste_real_pagado numeric(10,2),
  numero_factura text,
  factura_recibida text check (factura_recibida in ('Sí','No')),
  fecha_recepcion_factura date,
  factura_pagada text check (factura_pagada in ('Sí','No')),
  fecha_pago date,
  forma_pago text check (forma_pago in ('Transferencia','Otro')),

  -- Condiciones y notas
  condiciones_servicio text,
  observaciones text
);

alter table proveedores enable row level security;
create policy "acceso completo proveedores" on proveedores for all using (true) with check (true);
grant select, insert, update, delete on proveedores to anon, authenticated;
