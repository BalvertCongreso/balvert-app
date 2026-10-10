-- BALVERT 2027 — Migración: cuestionarios de satisfacción (Fase 8).
-- Ejecutar en Supabase SQL Editor (proyecto ya existente). Se puede
-- ejecutar más de una vez sin romper nada.
--
-- Dos cuestionarios por edición (asistentes y patrocinadores). Las cuatro
-- tablas solo se tocan desde el servidor con la clave de servicio: RLS
-- activado y SIN políticas, igual que portal_enlaces (ver 020).
--
-- ANONIMATO: encuesta_respuestas no tiene ningún vínculo con
-- encuesta_envios ni con el email (ni id, ni token, ni hora exacta: solo el
-- día). encuesta_envios solo sirve para saber a quién se envió y quién ha
-- contestado (para no mandarle recordatorio), y también guarda solo el día
-- en que contestó. El servidor marca el envío y guarda la respuesta en dos
-- operaciones separadas (no en la misma transacción), para que ni siquiera
-- los datos internos de PostgreSQL de la fila las relacionen.

create table if not exists encuestas (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid not null references ediciones(id) on delete cascade,
  publico text not null check (publico in ('asistentes', 'patrocinadores')),
  titulo text not null,
  introduccion text,
  -- Primer envío: desde entonces las preguntas quedan bloqueadas.
  enviada_en timestamptz,
  -- Cuándo se pidió el último recordatorio (los que salen otro día por el
  -- límite diario de emails se calculan a partir de esto).
  recordatorio_pedido_en timestamptz,
  cerrada boolean not null default false,
  creado timestamptz not null default now(),
  unique (edicion_id, publico)
);

create table if not exists encuesta_preguntas (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references encuestas(id) on delete cascade,
  orden integer not null,
  texto text not null,
  tipo text not null check (tipo in ('escala_1_5', 'si_no_quiza', 'opcion_unica', 'texto')),
  opciones jsonb,
  obligatoria boolean not null default false
);
create index if not exists encuesta_preguntas_encuesta on encuesta_preguntas (encuesta_id, orden);

create table if not exists encuesta_envios (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references encuestas(id) on delete cascade,
  email text not null,
  -- Solo el hash SHA-256 del enlace, nunca el enlace en claro.
  token_hash text not null unique,
  -- null = todavía no ha salido (límite diario de emails): sale con el cron.
  enviado_en timestamptz,
  recordatorio_en timestamptz,
  -- Solo el día, sin hora (ver ANONIMATO arriba).
  respondido_en date,
  unique (encuesta_id, email)
);

create table if not exists encuesta_respuestas (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references encuestas(id) on delete cascade,
  -- { "<id de la pregunta>": valor }
  respuestas jsonb not null,
  -- Solo el día, sin hora.
  fecha date not null
);
create index if not exists encuesta_respuestas_encuesta on encuesta_respuestas (encuesta_id);

alter table encuestas enable row level security;
alter table encuesta_preguntas enable row level security;
alter table encuesta_envios enable row level security;
alter table encuesta_respuestas enable row level security;
revoke all on encuestas, encuesta_preguntas, encuesta_envios, encuesta_respuestas from anon, authenticated;
grant select, insert, update, delete on encuestas, encuesta_preguntas, encuesta_envios, encuesta_respuestas to service_role;

-- Guardar la lista de preguntas de una vez (borra las que ya no están y
-- escribe el resto), y solo si el cuestionario no se ha enviado todavía: el
-- bloqueo de la fila evita que se cuele un cambio mientras se está enviando.
create or replace function guardar_preguntas_encuesta(p_encuesta_id uuid, p_preguntas jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enviada timestamptz;
begin
  select enviada_en into v_enviada from encuestas where id = p_encuesta_id for update;
  if not found then return 'no_existe'; end if;
  if v_enviada is not null then return 'enviada'; end if;

  delete from encuesta_preguntas where encuesta_id = p_encuesta_id;
  insert into encuesta_preguntas (encuesta_id, orden, texto, tipo, opciones, obligatoria)
  select p_encuesta_id,
         (p.ord - 1)::int,
         p.valor->>'texto',
         p.valor->>'tipo',
         case when p.valor->>'tipo' = 'opcion_unica' then p.valor->'opciones' else null end,
         coalesce((p.valor->>'obligatoria')::boolean, false)
  from jsonb_array_elements(p_preguntas) with ordinality as p(valor, ord);
  return 'ok';
end;
$$;

revoke execute on function guardar_preguntas_encuesta(uuid, jsonb) from public, anon, authenticated;
grant execute on function guardar_preguntas_encuesta(uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
