-- BALVERT 2027 — Migración: tipo "Factura" en los archivos del patrocinador.
-- (La 028 está reservada para el formulario de patrocinio aparcado: no se
-- ejecuta.) Ejecutar en Supabase SQL Editor. Se puede ejecutar más de una
-- vez sin romper nada.

alter table patrocinador_archivos drop constraint if exists patrocinador_archivos_tipo_check;
alter table patrocinador_archivos add constraint patrocinador_archivos_tipo_check
  check (tipo in ('logo', 'contrato', 'otro', 'ponencia', 'rollup', 'vinilado', 'factura'));

notify pgrst, 'reload schema';
