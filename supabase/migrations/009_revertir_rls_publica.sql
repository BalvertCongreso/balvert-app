-- BALVERT 2027 — Migración: revertir el acceso público por RLS en
-- asistentes_congreso/ediciones (Fase 2C-ii, cambio de estrategia).
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).
--
-- Motivo: se detectó un caso límite de Postgres en el que la política de
-- actualización pública de asistentes_congreso no combinaba correctamente
-- con la política general "solo con sesión" (confirmado con varias pruebas
-- diagnósticas: los permisos y los datos eran correctos, pero el UPDATE no
-- encontraba la fila ni con las políticas aisladas). En vez de seguir
-- ajustando RLS, el formulario público pasa a usar la clave "service_role"
-- solo en el servidor (nunca en el navegador), con toda la validación hecha
-- a mano en el código de la ruta. Con esto, "anon" ya no necesita ningún
-- permiso especial: vuelve a exigir sesión real en todo, igual que el resto
-- de tablas.

drop policy if exists "autorregistro público (alta) asistentes_congreso" on asistentes_congreso;
drop policy if exists "autorregistro público (actualización) asistentes_congreso" on asistentes_congreso;
drop policy if exists "lectura pública edición activa" on ediciones;

revoke insert, update on asistentes_congreso from anon;

-- La clave "service_role" (que usa ahora la ruta del formulario público)
-- nunca había recibido permisos explícitos en las tablas — desde el
-- principio del proyecto solo se le dieron a "anon" y "authenticated" en
-- schema.sql. service_role salta las políticas RLS, pero sigue necesitando
-- los permisos base de Postgres para poder leer/escribir.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
