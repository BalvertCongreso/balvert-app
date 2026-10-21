-- BALVERT 2027 — Migración: lo que empresas y clientes pueden editar en su
-- zona del portal (datos de la empresa, sus datos personales, sus invitados
-- y la ponencia). Ejecutar en Supabase SQL Editor. Se puede ejecutar más de
-- una vez sin romper nada.

-- 1) Ponente: email y teléfono (los rellena la empresa desde su zona).
alter table patrocinadores
  add column if not exists ponente_email text,
  add column if not exists ponente_telefono text;

-- 2) Cambiar campos de una ficha de patrocinador dejando el autor en el
--    historial ("Portal: <usuario>"). Sustituye a la versión de la 025: ahora
--    con lista de campos permitidos (cualquier otra clave se ignora). Solo la
--    usa el servidor con la clave de servicio, que ya valida qué puede cambiar
--    cada zona.
create or replace function actualizar_patrocinador_como(p_id uuid, p_autor text, p_campos jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_permitidos text[] := array[
    -- material y producción (025)
    'rollups_solicitados', 'rollup_por_nuestra_cuenta', 'vinilado_por_nuestra_cuenta',
    'logo_recibido', 'ponencia_recibida',
    -- ponencia
    'tiene_ponencia', 'ponente_nombre', 'ponente_cargo', 'ponente_email', 'ponente_telefono',
    'ponencia_titulo', 'ponencia_duracion_min',
    -- contactos
    'contacto1_nombre', 'contacto1_cargo', 'contacto1_email', 'contacto1_telefono',
    'contacto2_nombre', 'contacto2_cargo', 'contacto2_email', 'contacto2_telefono',
    -- facturación
    'razon_social_facturacion', 'cif_nif', 'direccion_fiscal', 'email_contabilidad',
    'canal_especial_facturacion'
  ];
  v_sets text;
begin
  select string_agg(format('%1$I = r.%1$I', k), ', ')
    into v_sets
    from jsonb_object_keys(p_campos) k
   where k = any(v_permitidos);
  if v_sets is null then
    return;
  end if;
  perform set_config('balvert.autor', left(coalesce(p_autor, ''), 200), true);
  execute format(
    'update patrocinadores t set %s from jsonb_populate_record(null::patrocinadores, $1) r where t.id = $2',
    v_sets
  ) using p_campos, p_id;
  perform set_config('balvert.autor', '', true);
end;
$$;

revoke all on function actualizar_patrocinador_como(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function actualizar_patrocinador_como(uuid, text, jsonb) to service_role;

-- 3) Altas, cambios y bajas en Congreso / Gala / Excursión hechas desde el
--    portal (invitados que añade o quita la empresa, datos que edita cada
--    cliente), con el autor en el historial. Solo esas tres tablas y solo la
--    clave de servicio: qué filas y qué campos se pueden tocar lo valida el
--    servidor antes de llamarlas.
create or replace function insertar_entrada_como(p_tabla text, p_autor text, p_fila jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_columnas text;
  v_resultado jsonb;
begin
  if p_tabla not in ('asistentes_congreso', 'gala', 'excursion') then
    raise exception 'Tabla no permitida: %', p_tabla;
  end if;
  select string_agg(format('%I', k), ', ') into v_columnas
    from jsonb_object_keys(p_fila) k
   where k <> 'id';
  perform set_config('balvert.autor', left(coalesce(p_autor, ''), 200), true);
  execute format(
    'insert into %1$I (%2$s) select %2$s from jsonb_populate_record(null::%1$I, $1) returning to_jsonb(%1$I.*)',
    p_tabla, v_columnas
  ) using p_fila into v_resultado;
  perform set_config('balvert.autor', '', true);
  return v_resultado;
end;
$$;

create or replace function actualizar_entrada_como(p_tabla text, p_id uuid, p_autor text, p_campos jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_sets text;
begin
  if p_tabla not in ('asistentes_congreso', 'gala', 'excursion') then
    raise exception 'Tabla no permitida: %', p_tabla;
  end if;
  select string_agg(format('%1$I = r.%1$I', k), ', ') into v_sets
    from jsonb_object_keys(p_campos) k
   where k not in ('id', 'edicion_id', 'qr_codigo', 'check_in_hecho', 'check_in_fecha');
  if v_sets is null then
    return;
  end if;
  perform set_config('balvert.autor', left(coalesce(p_autor, ''), 200), true);
  execute format(
    'update %1$I t set %2$s from jsonb_populate_record(null::%1$I, $1) r where t.id = $2',
    p_tabla, v_sets
  ) using p_campos, p_id;
  perform set_config('balvert.autor', '', true);
end;
$$;

create or replace function borrar_entrada_como(p_tabla text, p_id uuid, p_autor text)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_tabla not in ('asistentes_congreso', 'gala', 'excursion') then
    raise exception 'Tabla no permitida: %', p_tabla;
  end if;
  perform set_config('balvert.autor', left(coalesce(p_autor, ''), 200), true);
  execute format('delete from %I where id = $1', p_tabla) using p_id;
  perform set_config('balvert.autor', '', true);
end;
$$;

revoke all on function insertar_entrada_como(text, text, jsonb) from public, anon, authenticated;
revoke all on function actualizar_entrada_como(text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function borrar_entrada_como(text, uuid, text) from public, anon, authenticated;
grant execute on function insertar_entrada_como(text, text, jsonb) to service_role;
grant execute on function actualizar_entrada_como(text, uuid, text, jsonb) to service_role;
grant execute on function borrar_entrada_como(text, uuid, text) to service_role;

notify pgrst, 'reload schema';
