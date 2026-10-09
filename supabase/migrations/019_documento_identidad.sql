-- BALVERT 2027 — Migración: documento de identidad por asistente.
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).
--
-- DNI, NIE o pasaporte de cada persona que compra entrada por /entradas
-- (obligatorio allí, validado en el formulario y en crear-sesion). Nullable:
-- las filas antiguas y las altas manuales/invitaciones del panel no lo
-- tienen. Finalidades: identificar al asistente en el acceso, justificante
-- de asistencia y facturación. Sin lectura pública: estas tablas siguen
-- exigiendo sesión (ver 007_login_real_rls.sql / 009_revertir_rls_publica.sql).
alter table asistentes_congreso add column if not exists documento_identidad text;
alter table gala add column if not exists documento_identidad text;
alter table excursion add column if not exists documento_identidad text;
