-- BALVERT 2027 — Migración: Fase 2C-ii, formulario público de inscripción
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

-- 1) nombre opcional en asistentes_congreso, para soportar las "invitaciones
--    vacías" que crea Patrocinadores (plazas reservadas sin nombre todavía).
alter table asistentes_congreso alter column nombre drop not null;

-- 2) Evitar duplicados: como mucho una fila por email dentro de la misma
--    edición (los email nulos —invitaciones vacías— no cuentan como
--    duplicados entre sí, es el comportamiento estándar de NULL en un UNIQUE).
alter table asistentes_congreso
  add constraint asistentes_congreso_email_edicion_key unique (email, edicion_id);

-- 3) Lectura pública SOLO de la edición activa en `ediciones` (nombre,
--    lugar/hora...), necesaria para que el formulario público sepa a qué
--    edición apuntar la inscripción. No hay datos sensibles en esta tabla.
create policy "lectura pública edición activa" on ediciones
  for select
  to anon
  using (activa = true);

-- 4) Autorregistro público en asistentes_congreso: solo INSERT/UPDATE,
--    nunca SELECT ni DELETE, y limitado a un puñado de columnas concretas.
--    Primero se retira el permiso amplio que ya tenía "anon" desde el
--    arranque del proyecto (grant a nivel de tabla completa), para dar en su
--    lugar uno estrecho a nivel de columna.
revoke insert, update on asistentes_congreso from anon;

grant insert (id, nombre, email, telefono, cargo, edicion_id, tipo_acceso, confirmado, qr_codigo)
  on asistentes_congreso to anon;
grant update (nombre, telefono, cargo, qr_codigo, entrada_enviada)
  on asistentes_congreso to anon;

create policy "autorregistro público (alta) asistentes_congreso" on asistentes_congreso
  for insert
  to anon
  with check (tipo_acceso = 'Independiente' and confirmado = 'Pendiente');

create policy "autorregistro público (actualización) asistentes_congreso" on asistentes_congreso
  for update
  to anon
  using (tipo_acceso = 'Independiente')
  with check (tipo_acceso = 'Independiente');
