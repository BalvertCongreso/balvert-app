-- BALVERT 2027 — Migración: compra de entradas con menú/alergias (Gala),
-- precio de colegiado (Congreso) y tabla de compras pendientes.
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

-- 1) Precio de colegiado del Congreso, editable en Ediciones → "Precios
--    (compra online)". Nullable y sin valor por defecto, igual que el resto
--    de precios: vacío (o 0) = no se ofrece la casilla "Soy colegiado".
alter table ediciones add column if not exists precio_congreso_colegiado numeric(10,2);

-- 2) Datos de colegiado por cada entrada de Congreso. Se rellenan desde el
--    formulario público /entradas y Ariadna los revisa/corrige desde la
--    ficha. No hay verificación automática del número.
alter table asistentes_congreso
  add column if not exists colegiado_profesional boolean default false,
  add column if not exists nombre_colegio text,
  add column if not exists numero_colegiado text;

-- 3) Compras pendientes de pago. /api/stripe/crear-sesion guarda aquí la
--    compra completa (comprador, personas y sus datos, precio unitario
--    calculado en el servidor) y a Stripe solo le pasa el id de esta fila
--    en la metadata — así no hay tope de tamaño (la metadata de Stripe
--    admite ~500 caracteres por valor). El webhook lee esta fila tras
--    verificar la firma, crea las entradas y la marca como usada.
create table if not exists compras_pendientes (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  edicion_id uuid references ediciones(id),
  comprador_email text not null,
  comprador_telefono text,
  comprador_cargo text,
  -- { "congreso": [{nombre, colegiado_profesional, nombre_colegio, numero_colegiado, precio}],
  --   "gala": [{nombre, menu, alergias_intolerancias, precio}],
  --   "excursion": [{nombre, precio}] }
  grupos jsonb not null,
  importe_total_cents integer not null,
  stripe_session_id text,
  referencia_pago_online text,
  usada_en timestamptz
);

-- Solo accesible con la clave de servicio (desde las rutas del servidor),
-- igual que el resto de lo público: RLS activado y SIN ninguna política,
-- así que anon y authenticated no pueden leer ni escribir nada. service_role
-- salta RLS, pero necesita los permisos base (ver 009_revertir_rls_publica.sql).
alter table compras_pendientes enable row level security;
revoke all on compras_pendientes from anon, authenticated;
grant select, insert, update, delete on compras_pendientes to service_role;
