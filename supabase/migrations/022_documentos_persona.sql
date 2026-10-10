-- BALVERT 2027 — Migración: documentos para una persona concreta (p. ej. la
-- factura de Holded de quien la pidió desde el portal).
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).

alter table documentos add column if not exists email_destinatario text;

-- Se sustituyen las comprobaciones de 021 (destino permitido y que la
-- empresa solo vaya con destino "patrocinador") por unas que incluyen el
-- destino nuevo "asistente", que va siempre con email.
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'documentos'::regclass and contype = 'c' loop
    execute format('alter table documentos drop constraint %I', r.conname);
  end loop;
end $$;

alter table documentos add constraint documentos_destino_valido
  check (destino in ('todos_asistentes', 'todos_patrocinadores', 'patrocinador', 'asistente'));
alter table documentos add constraint documentos_destino_empresa
  check ((destino = 'patrocinador') = (patrocinador_id is not null));
alter table documentos add constraint documentos_destino_persona
  check ((destino = 'asistente') = (email_destinatario is not null));
