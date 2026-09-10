-- BALVERT 2027 — Migración: Fase 2B, lugar y hora por evento en ediciones
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

alter table ediciones add column if not exists lugar_congreso text;
alter table ediciones add column if not exists fecha_hora_congreso timestamp;
alter table ediciones add column if not exists lugar_gala text;
alter table ediciones add column if not exists fecha_hora_gala timestamp;
alter table ediciones add column if not exists lugar_excursion text;
alter table ediciones add column if not exists fecha_hora_excursion timestamp;
