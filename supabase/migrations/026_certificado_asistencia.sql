-- BALVERT 2027 — Migración: certificado de asistencia del Congreso (Fase 9).
-- Ejecutar en Supabase SQL Editor (proyecto ya existente). Se puede
-- ejecutar más de una vez sin romper nada.
--
-- El PDF no se guarda: se genera al momento desde la fila del asistente y
-- estos datos de la edición. Aquí solo van los textos y las imágenes.

alter table ediciones
  add column if not exists certificado_titulo text,
  add column if not exists certificado_lugar text,
  add column if not exists certificado_dias text,
  add column if not exists certificado_cabecera_linea1 text,
  add column if not exists certificado_cabecera_linea2 text,
  add column if not exists certificado_firmante text,
  add column if not exists certificado_cargo text,
  -- Rutas dentro del bucket privado "certificados" (las pone el servidor).
  add column if not exists certificado_firma_ruta text,
  add column if not exists certificado_imagen_ruta text;

-- Precarga en la edición activa (solo lo que esté vacío: no pisa nada).
update ediciones set certificado_titulo = 'IV Congreso Internacional de Balsas y Vertederos'
  where activa and certificado_titulo is null;
update ediciones set certificado_lugar = 'Barcelona' where activa and certificado_lugar is null;
update ediciones set certificado_dias = '16 y 17 de marzo de 2027' where activa and certificado_dias is null;
update ediciones set certificado_cabecera_linea1 = '16 y 17 DE MARZO' where activa and certificado_cabecera_linea1 is null;
update ediciones set certificado_cabecera_linea2 = '2027 - BARCELONA' where activa and certificado_cabecera_linea2 is null;
update ediciones set certificado_firmante = 'Ariosto de Haro' where activa and certificado_firmante is null;
update ediciones set certificado_cargo = 'Director del congreso' where activa and certificado_cargo is null;

-- Bucket PRIVADO para la firma y la imagen de cabecera. Sin políticas en
-- storage.objects: solo el servidor (clave de servicio) lo lee y escribe.
-- Solo PNG/JPG (lo que se puede incrustar en el PDF), máximo 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificados', 'certificados', false, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
