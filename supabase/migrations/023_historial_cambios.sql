-- BALVERT 2027 — Migración: historial de cambios en Patrocinadores,
-- Proveedores, Congreso, Gala y Excursión.
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).
--
-- Lo registra la propia base de datos con triggers, así que queda todo
-- venga de donde venga: pantallas internas, webhook de Stripe, portal,
-- limpiezas… No se reconstruye nada anterior: empieza vacío.

create table if not exists historial_cambios (
  id uuid primary key default gen_random_uuid(),
  tabla text not null,
  registro_id uuid not null,
  accion text not null check (accion in ('creado', 'modificado', 'borrado')),
  -- { "campo": { "antes": valor, "despues": valor }, ... }
  cambios jsonb not null default '{}'::jsonb,
  autor text not null,
  fecha timestamptz not null default now()
);

create index if not exists historial_cambios_tabla_registro_fecha
  on historial_cambios (tabla, registro_id, fecha desc);

-- Solo lectura para el panel interno; nadie escribe ni borra desde la app
-- (solo el trigger, que corre como dueño de la tabla).
alter table historial_cambios enable row level security;
revoke all on historial_cambios from anon, authenticated;
grant select on historial_cambios to authenticated;
grant select, insert, update, delete on historial_cambios to service_role;

drop policy if exists "historial solo lectura con sesión" on historial_cambios;
create policy "historial solo lectura con sesión" on historial_cambios
  for select to authenticated
  using (auth.uid() is not null);

-- Autor: el email de la sesión traducido a nombre, con el mismo mapeo que la
-- política de notas_privadas (017). Sin sesión (clave de servicio: webhook de
-- Stripe, portal, limpiezas; o el propio SQL Editor) → "Sistema (compra online)".
-- qr_codigo no se guarda nunca: es la llave de la entrada.
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
    when '' then 'Sistema (compra online)'
    else v_email
  end;

  for v_campo in
    select jsonb_object_keys(v_antes) union select jsonb_object_keys(v_despues)
  loop
    continue when v_campo in ('id', 'qr_codigo');
    -- (al crear, una columna vacía no es un "cambio": null frente a null)
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

  -- Guardar sin cambiar nada (o cambiar solo qr_codigo) no deja rastro.
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

do $$
declare t text;
begin
  foreach t in array array['patrocinadores', 'proveedores', 'asistentes_congreso', 'gala', 'excursion'] loop
    execute format('drop trigger if exists historial_cambios on %I', t);
    execute format(
      'create trigger historial_cambios after insert or update or delete on %I
         for each row execute function registrar_historial_cambios()', t);
  end loop;
end $$;
