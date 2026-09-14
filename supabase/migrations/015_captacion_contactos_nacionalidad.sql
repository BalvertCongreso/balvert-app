-- BALVERT 2027 — Migración: Captación y Contactos, Nacionalidad
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

alter table prospectos_patrocinio
  add column if not exists nacionalidad text;

alter table contactos_newsletter
  add column if not exists nacionalidad text;
