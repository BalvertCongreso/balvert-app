-- BALVERT 2027 — Migración: Login real (Supabase Auth) antes de la Fase 2C
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).
--
-- Sustituye las políticas "acceso completo a cualquiera con la clave anon"
-- por "acceso completo solo con sesión iniciada" en todas las tablas internas.

drop policy if exists "acceso completo ediciones" on ediciones;
create policy "solo con sesión ediciones" on ediciones for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "acceso completo patrocinadores" on patrocinadores;
create policy "solo con sesión patrocinadores" on patrocinadores for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "acceso completo gala" on gala;
create policy "solo con sesión gala" on gala for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "acceso completo excursion" on excursion;
create policy "solo con sesión excursion" on excursion for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "acceso completo tareas" on tareas;
create policy "solo con sesión tareas" on tareas for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "acceso completo proveedores" on proveedores;
create policy "solo con sesión proveedores" on proveedores for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "acceso completo asistentes_congreso" on asistentes_congreso;
create policy "solo con sesión asistentes_congreso" on asistentes_congreso for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "acceso completo tarea_comentarios" on tarea_comentarios;
create policy "solo con sesión tarea_comentarios" on tarea_comentarios for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "acceso completo notas_compartidas" on notas_compartidas;
create policy "solo con sesión notas_compartidas" on notas_compartidas for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "acceso completo notas_privadas" on notas_privadas;
create policy "solo con sesión notas_privadas" on notas_privadas for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ================================================================
-- PREPARADO PARA FASE 2C-ii (formulario público de autorregistro) —
-- NO EJECUTAR TODAVÍA. Cuando se construya ese formulario, se añadirá
-- ADEMÁS esta política (sin tocar la de arriba), para permitir que
-- cualquiera sin sesión pueda CREAR una fila en asistentes_congreso
-- (nunca leer, editar ni borrar):
--
-- create policy "autorregistro público asistentes_congreso" on asistentes_congreso
--   for insert
--   to anon
--   with check (true);
-- ================================================================
