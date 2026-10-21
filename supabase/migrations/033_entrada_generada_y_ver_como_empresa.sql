-- BALVERT 2027 — Migración: generar entradas sin enviarlas y «Ver como la
-- empresa» desde el panel. Ejecutar en Supabase SQL Editor. Se puede
-- ejecutar más de una vez sin romper nada.

-- 1) Historial: el código del QR sigue sin guardarse nunca, pero cuando una
--    fila pasa de no tener entrada a tenerla se anota «Entrada generada: Sí»
--    (antes no quedaba rastro de generar una entrada sin enviarla). El resto
--    de la función es igual que en la 025.
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

  if tg_op <> 'DELETE'
     and coalesce(v_antes ->> 'qr_codigo', '') = ''
     and coalesce(v_despues ->> 'qr_codigo', '') <> '' then
    v_cambios := v_cambios || jsonb_build_object(
      'entrada_generada', jsonb_build_object('antes', 'No', 'despues', 'Sí')
    );
  end if;

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

-- 2) «Ver como la empresa»: sesión de empresa abierta desde el panel, marcada
--    como de la organización y con el nombre de quien la abre. No cuenta como
--    acceso de la empresa y sus cambios van a nombre de esa persona.
alter table patrocinador_sesiones
  add column if not exists modo_organizacion boolean not null default false,
  add column if not exists organizador text;

notify pgrst, 'reload schema';
