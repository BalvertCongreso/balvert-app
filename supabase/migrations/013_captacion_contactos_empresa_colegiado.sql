-- BALVERT 2027 — Migración: Captación y Contactos, Empresa / Entidad pública / Colegiado profesional
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

alter table prospectos_patrocinio
  add column if not exists empresa text,
  add column if not exists entidad_publica text,
  add column if not exists colegiado_profesional boolean default false,
  add column if not exists nombre_colegio text;

-- Migrar el dato ya existente: empresa_entidad -> empresa.
-- La columna empresa_entidad se queda en la base de datos (no se borra),
-- pero deja de usarse en el formulario y en el listado a partir de ahora.
update prospectos_patrocinio
set empresa = empresa_entidad
where empresa is null and empresa_entidad is not null;

alter table contactos_newsletter
  add column if not exists empresa text,
  add column if not exists entidad_publica text,
  add column if not exists colegiado_profesional boolean default false,
  add column if not exists nombre_colegio text;
