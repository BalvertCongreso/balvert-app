-- BALVERT 2027 — Migración: Fase 7a/7b, base técnica de pagos con Stripe
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

-- 1) Precio manual por edición y tipo de entrada (Congreso/Gala/Excursión).
--    Nullable y sin valor por defecto: Ariadna los rellena a mano desde la
--    pantalla Ediciones cuando decida los importes. Independiente de los
--    campos de precio que ya existen por cada asistente
--    (asistentes_congreso.precio, gala.precio_entrada, excursion.precio),
--    que siguen usándose igual para altas manuales/invitaciones.
alter table ediciones add column if not exists precio_congreso numeric(10,2);
alter table ediciones add column if not exists precio_gala numeric(10,2);
alter table ediciones add column if not exists precio_excursion numeric(10,2);

-- 2) Quita la restricción de un email único por edición en
--    asistentes_congreso (creada en 008_inscripcion_publica.sql). Ya no es
--    válida: una sola compra por Stripe podrá crear varias filas de
--    Congreso bajo el mismo email de quien compra (compra múltiple, igual
--    que ya funciona hoy en gala/excursion, donde nunca existió esta
--    restricción). La identificación de duplicados en el webhook de Stripe
--    se apoya en qr_codigo (único) y en referencia_pago_online, no en el
--    email.
alter table asistentes_congreso drop constraint if exists asistentes_congreso_email_edicion_key;
