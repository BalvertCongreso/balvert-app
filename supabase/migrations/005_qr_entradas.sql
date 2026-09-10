-- BALVERT 2027 — Migración: Fase 2B, entradas con QR
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

-- Identificador único del QR (para validar en el check-in de Fase 3), en las 3 tablas de inscripción.
alter table asistentes_congreso add column if not exists qr_codigo text unique;
alter table gala add column if not exists qr_codigo text unique;
alter table excursion add column if not exists qr_codigo text unique;

-- excursion no tenía email ni "entrada enviada" en el Excel original.
-- Se añaden aquí (aprobado por Ariadna) para poder mandar la entrada QR por
-- email igual que en Congreso y Gala.
alter table excursion add column if not exists email_asistente text;
alter table excursion add column if not exists entrada_enviada text check (entrada_enviada in ('Sí','No'));
