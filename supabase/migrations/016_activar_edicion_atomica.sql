-- BALVERT 2027 — Migración: activar edición de forma atómica
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).
--
-- Antes, marcar una edición como activa eran dos llamadas sueltas desde el
-- cliente (desactivar todas, luego activar la elegida). Si algo fallaba
-- justo entre medias, la app se quedaba sin ninguna edición activa. Esta
-- función hace las dos cosas dentro de una única transacción de base de
-- datos, así que no puede quedar a medias.
--
-- Sin "security definer": la política RLS "solo con sesión ediciones" ya
-- permite cualquier operación a todo usuario autenticado, así que la función
-- puede ejecutarse con los privilegios del propio usuario que llama (más
-- simple y no abre ninguna puerta extra).
create or replace function activar_edicion(edicion_id uuid)
returns void
language plpgsql
as $$
begin
  update ediciones set activa = false where id <> edicion_id;
  update ediciones set activa = true where id = edicion_id;
end;
$$;

grant execute on function activar_edicion(uuid) to authenticated;
