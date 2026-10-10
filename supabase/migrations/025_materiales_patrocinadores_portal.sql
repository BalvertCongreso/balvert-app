-- BALVERT 2027 — Migración: materiales de patrocinadores desde el portal
-- (logos, ponencias, rollups, vinilados y datos del ponente).
-- Ejecutar en Supabase SQL Editor (proyecto ya existente). Se puede
-- ejecutar más de una vez sin romper nada.

-- 1) Archivos de la ficha: nuevos tipos, quién lo subió (equipo o la propia
--    empresa desde el portal), comentario y si el equipo lo deja ver en el
--    área de la empresa.
alter table patrocinador_archivos drop constraint if exists patrocinador_archivos_tipo_check;
alter table patrocinador_archivos add constraint patrocinador_archivos_tipo_check
  check (tipo in ('logo', 'contrato', 'otro', 'ponencia', 'rollup', 'vinilado'));

alter table patrocinador_archivos
  add column if not exists origen text not null default 'equipo',
  add column if not exists email_subida text,
  add column if not exists comentario text,
  add column if not exists visible_empresa boolean not null default false;

alter table patrocinador_archivos drop constraint if exists patrocinador_archivos_origen_check;
alter table patrocinador_archivos add constraint patrocinador_archivos_origen_check
  check (origen in ('equipo', 'patrocinador'));

-- 2) Bucket: además de PDF/imágenes/AI/EPS, presentaciones (PPTX, PPT y
--    Keynote) para las ponencias. Sigue privado y con 50 MB por archivo.
update storage.buckets
set allowed_mime_types = array[
      'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
      'image/svg+xml', 'application/postscript',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'application/vnd.apple.keynote'],
    file_size_limit = 52428800
where id = 'patrocinadores-archivos';

-- 3) Patrocinadores: cuántos rollups ha pedido que le fabriquemos (vacío
--    cuenta como 0: el formulario de la ficha manda vacío lo que no se rellena).
alter table patrocinadores
  add column if not exists rollups_solicitados integer default 0;
alter table patrocinadores drop constraint if exists patrocinadores_rollups_solicitados_check;
alter table patrocinadores add constraint patrocinadores_rollups_solicitados_check
  check (rollups_solicitados between 0 and 99);

-- 4) Ediciones: precios de rollup y vinilado, condiciones y "qué incluye"
--    cada categoría (se editan en Ediciones → "Material para patrocinadores").
alter table ediciones
  add column if not exists precio_rollup numeric,
  add column if not exists precio_vinilado numeric,
  add column if not exists texto_material_patrocinadores text,
  add column if not exists incluye_diamante text,
  add column if not exists incluye_oro text,
  add column if not exists incluye_plata text;

-- Precarga en la edición activa (solo lo que esté vacío: no pisa nada).
update ediciones set precio_rollup = 280 where activa and precio_rollup is null;
update ediciones set precio_vinilado = 125 where activa and precio_vinilado is null;

update ediciones set texto_material_patrocinadores = $t$Rollup: producción de rollup de 150 × 200 cm. Cualquier patrocinador puede pedir los que quiera, sea de la categoría que sea. (Recuerda: el patrocinio Diamante incluye la colocación de 2 roll ups y el Oro la de 1; aquí nos pides que te los fabriquemos.)

Vinilado del mostrador: precio cerrado por el mostrador completo (no por m²).
- Oro: mostrador de 92 cm de ancho × 93 cm de alto × 46 cm de fondo, 6 m² disponibles.
- Diamante: espacio doble, mostrador de 120 cm × 93 cm de alto, 9 m² disponibles.

Los precios no incluyen IVA. No se paga online: te enviaremos la factura.$t$
where activa and texto_material_patrocinadores is null;

update ediciones set incluye_diamante = $t$- 10 invitaciones.
- 1 invitación a la cena de gala.
- 1 invitación a la excursión técnica.
- Ponencia: 5 min de presentación de empresa o producto + 10 min de caso técnico.
- Logotipo destacado, con mayor visibilidad, en todos los soportes: carpetas, folios, folletos, web, redes sociales, roll ups y photocall de 300 × 200.
- Logo en el escenario.
- Único nivel con presencia en la web, con banner de publicidad.
- Logo en la mochila del congreso.
- Entrevista en redes sociales.
- Espacio doble para mostrador en lugar preferente de la zona comercial (cafés y almuerzo), para exhibir productos y material para los Welcome Pack. Puedes elegir el lugar del mostrador.
- 2 roll ups (zona comercial y laterales de la sala de conferencias).
- Dos directivos en los lugares de protocolo.
- Preside la mesa redonda de su bloque temático.
- Puede optar a patrocinar la cena institucional, la excursión técnica, los identificadores, etc.
- Mostrador y asientos incluidos.$t$
where activa and incluye_diamante is null;

update ediciones set incluye_oro = $t$- 5 invitaciones.
- Ponencia: 5 min de presentación de empresa o producto + 5 min de caso técnico.
- Logotipo destacado en todos los soportes: carpetas, folios, folletos, web, redes sociales, roll ups y photocall de 300 × 200.
- Presencia en cartelería.
- Entrevista en redes sociales.
- 1 espacio para mostrador en lugar preferente de la zona comercial, para exhibir productos y material para los Welcome Pack.
- 1 roll up, a elegir entre la zona comercial o los laterales de la sala.
- Un directivo en los lugares de protocolo.
- Participación en la mesa redonda de su bloque temático.
- Mostrador y asientos incluidos.$t$
where activa and incluye_oro is null;

update ediciones set incluye_plata = $t$- 2 invitaciones.
- Sin ponencia incluida, salvo que el Comité Técnico la considere de alto valor y decida incorporarla.
- Logotipo en todos los soportes: carpetas, folios, folletos, web, redes sociales, roll ups y photocall de 300 × 200.
- Presencia en cartelería.
- Posibilidad de entrevista en redes sociales.
- Aparición en el listado de patrocinadores del programa oficial.$t$
where activa and incluye_plata is null;

-- 5) Registro de acciones del portal: para el límite de subidas y avisos
--    por persona y hora (anti-abuso), y para comprobar que el archivo que
--    se registra es uno que preparó esa misma persona (detalle = ruta).
--    Solo la clave de servicio.
create table if not exists portal_acciones (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  accion text not null,
  detalle text,
  creado timestamptz not null default now()
);
create index if not exists portal_acciones_email_creado on portal_acciones (email, creado desc);
alter table portal_acciones enable row level security;
revoke all on portal_acciones from anon, authenticated;
grant select, insert, delete on portal_acciones to service_role;

-- 6) Historial: autor de los cambios hechos por el servidor. Hasta ahora,
--    todo lo que no llevaba sesión del panel salía como "Sistema (compra
--    online)". Ahora el servidor puede decir quién fue ("Portal: email",
--    "Ariadna"…) cambiando la ficha SOLO a través de la función de abajo,
--    que guarda el autor en una variable de la propia transacción. Si hay
--    sesión del panel, manda el email de la sesión, como siempre.
create or replace function registrar_historial_cambios()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_autor text;
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  v_despues jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  v_cambios jsonb := '{}'::jsonb;
  v_campo text;
begin
  v_autor := case v_email
    when 'secretaria@balvert.es' then 'Ariadna'
    when 'ariosto@balvert.es' then 'Ariosto'
    when '' then coalesce(nullif(current_setting('balvert.autor', true), ''), 'Sistema (compra online)')
    else v_email
  end;

  for v_campo in
    select jsonb_object_keys(v_antes) union select jsonb_object_keys(v_despues)
  loop
    continue when v_campo in ('id', 'qr_codigo');
    if coalesce(v_antes -> v_campo, 'null'::jsonb) <> coalesce(v_despues -> v_campo, 'null'::jsonb) then
      v_cambios := v_cambios || jsonb_build_object(
        v_campo,
        jsonb_build_object(
          'antes', coalesce(v_antes -> v_campo, 'null'::jsonb),
          'despues', coalesce(v_despues -> v_campo, 'null'::jsonb)
        )
      );
    end if;
  end loop;

  if tg_op = 'UPDATE' and v_cambios = '{}'::jsonb then
    return null;
  end if;

  insert into historial_cambios (tabla, registro_id, accion, cambios, autor)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    case tg_op when 'INSERT' then 'creado' when 'UPDATE' then 'modificado' else 'borrado' end,
    v_cambios,
    v_autor
  );
  return null;
end;
$$;

revoke all on function registrar_historial_cambios() from public, anon, authenticated;

-- Cambia SOLO estos campos de una ficha, dejando constancia del autor en el
-- historial. Solo la puede usar el servidor (clave de servicio): el portal
-- (/api/portal/*) y el borrado de archivos desde la ficha. Cualquier otra
-- clave de p_campos se ignora.
create or replace function actualizar_patrocinador_como(p_id uuid, p_autor text, p_campos jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  perform set_config('balvert.autor', left(coalesce(p_autor, ''), 200), true);
  update patrocinadores set
    rollups_solicitados = case when p_campos ? 'rollups_solicitados'
      then (p_campos ->> 'rollups_solicitados')::integer else rollups_solicitados end,
    rollup_por_nuestra_cuenta = case when p_campos ? 'rollup_por_nuestra_cuenta'
      then p_campos ->> 'rollup_por_nuestra_cuenta' else rollup_por_nuestra_cuenta end,
    vinilado_por_nuestra_cuenta = case when p_campos ? 'vinilado_por_nuestra_cuenta'
      then p_campos ->> 'vinilado_por_nuestra_cuenta' else vinilado_por_nuestra_cuenta end,
    logo_recibido = case when p_campos ? 'logo_recibido'
      then p_campos ->> 'logo_recibido' else logo_recibido end,
    ponencia_recibida = case when p_campos ? 'ponencia_recibida'
      then p_campos ->> 'ponencia_recibida' else ponencia_recibida end,
    ponente_nombre = case when p_campos ? 'ponente_nombre'
      then p_campos ->> 'ponente_nombre' else ponente_nombre end,
    ponente_cargo = case when p_campos ? 'ponente_cargo'
      then p_campos ->> 'ponente_cargo' else ponente_cargo end,
    ponencia_titulo = case when p_campos ? 'ponencia_titulo'
      then p_campos ->> 'ponencia_titulo' else ponencia_titulo end,
    ponencia_duracion_min = case when p_campos ? 'ponencia_duracion_min'
      then (p_campos ->> 'ponencia_duracion_min')::integer else ponencia_duracion_min end
  where id = p_id;
  perform set_config('balvert.autor', '', true);
end;
$$;

revoke all on function actualizar_patrocinador_como(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function actualizar_patrocinador_como(uuid, text, jsonb) to service_role;

-- Que la API vea las columnas nuevas sin esperar.
notify pgrst, 'reload schema';
