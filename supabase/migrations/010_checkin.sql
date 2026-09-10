-- BALVERT 2027 — Migración: Fase 3, check-in del QR en la puerta
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

-- Marca si esa entrada ya se validó físicamente en la puerta, y cuándo.
-- Separado de "confirmado" (que es la RSVP previa) y de "entrada_enviada"
-- (que es si se envió el email): el check-in es la llegada real al evento.
alter table asistentes_congreso add column if not exists check_in_hecho text check (check_in_hecho in ('Sí','No')) default 'No';
alter table asistentes_congreso add column if not exists check_in_fecha timestamptz;

alter table gala add column if not exists check_in_hecho text check (check_in_hecho in ('Sí','No')) default 'No';
alter table gala add column if not exists check_in_fecha timestamptz;

alter table excursion add column if not exists check_in_hecho text check (check_in_hecho in ('Sí','No')) default 'No';
alter table excursion add column if not exists check_in_fecha timestamptz;
