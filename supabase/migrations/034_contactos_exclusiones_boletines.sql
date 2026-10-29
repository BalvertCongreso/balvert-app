-- BALVERT 2027 — Migración: Contactos «Excluido de envíos» (rebotes, bajas y
-- exclusiones manuales) e histórico de boletines por contacto.
-- Ejecutar en Supabase SQL Editor. Se puede ejecutar más de una vez sin
-- romper nada. No cambia ni borra ningún contacto: todos quedan «Activo».

-- 1) Estado de cada contacto. Por defecto Activo; un Excluido no entra en
--    ningún boletín. Los rebotes temporales («soft») no excluyen: solo se
--    cuentan y se anota la fecha del último.
alter table contactos_newsletter
  add column if not exists estado text not null default 'Activo',
  add column if not exists motivo_exclusion text,
  add column if not exists fecha_exclusion timestamptz,
  add column if not exists rebotes_temporales integer not null default 0,
  add column if not exists fecha_ultimo_rebote_temporal timestamptz;

alter table contactos_newsletter drop constraint if exists contactos_newsletter_estado_check;
alter table contactos_newsletter add constraint contactos_newsletter_estado_check check (
  (estado = 'Activo' and motivo_exclusion is null)
  or (estado = 'Excluido' and motivo_exclusion in ('Rebote', 'Baja', 'Manual'))
);

-- 2) El mismo email no puede estar dos veces aunque llegue con mayúsculas o
--    espacios (Captación, alta manual, importación): así un excluido nunca
--    «vuelve a entrar» como contacto nuevo y activo. Hoy todos los emails ya
--    están en minúsculas y sin repetir (comprobado el 29/10/2026).
create or replace function normalizar_email_contacto()
returns trigger
language plpgsql
as $$
begin
  new.email := nullif(lower(btrim(new.email)), '');
  return new;
end;
$$;

drop trigger if exists contactos_newsletter_normalizar_email on contactos_newsletter;
create trigger contactos_newsletter_normalizar_email
  before insert or update of email on contactos_newsletter
  for each row execute function normalizar_email_contacto();

create unique index if not exists contactos_newsletter_email_normalizado
  on contactos_newsletter (lower(btrim(email)));

-- 3) Boletines: los enviados desde la app y los que se manden desde el panel
--    de Mailrelay (si se registran al consultar Mailrelay).
create table if not exists boletines (
  id uuid primary key default gen_random_uuid(),
  mailrelay_campaign_id bigint,
  mailrelay_sent_campaign_id bigint unique,
  asunto text,
  fecha_envio timestamptz not null default now(),
  -- Origen de lista al que se mandó, o «Todos».
  origen_lista text not null default 'Todos',
  destinatarios integer not null default 0,
  enviado_desde text not null default 'App' check (enviado_desde in ('App', 'Mailrelay')),
  creado timestamptz not null default now()
);

create index if not exists boletines_mailrelay_campaign on boletines (mailrelay_campaign_id);

-- 4) Histórico por contacto: como mucho una fila por boletín; el resultado
--    se actualiza (Enviado → Rebote, Rebote temporal o Baja).
create table if not exists contacto_boletines (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references contactos_newsletter(id) on delete cascade,
  boletin_id uuid not null references boletines(id) on delete cascade,
  fecha timestamptz not null default now(),
  resultado text not null default 'Enviado'
    check (resultado in ('Enviado', 'Rebote', 'Rebote temporal', 'Baja')),
  unique (contacto_id, boletin_id)
);

create index if not exists contacto_boletines_boletin on contacto_boletines (boletin_id);

-- 5) Acceso: igual que el resto de tablas internas, solo con el login del panel.
alter table boletines enable row level security;
alter table contacto_boletines enable row level security;

drop policy if exists "solo con sesión boletines" on boletines;
create policy "solo con sesión boletines" on boletines
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "solo con sesión contacto_boletines" on contacto_boletines;
create policy "solo con sesión contacto_boletines" on contacto_boletines
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

revoke all on boletines, contacto_boletines from anon;
grant select, insert, update, delete on boletines, contacto_boletines to authenticated;
grant select, insert, update, delete on boletines, contacto_boletines to service_role;

-- 6) Anotar rebotes temporales de golpe (suma 1 y apunta la fecha) sin tocar
--    el estado. Se ejecuta con los permisos de quien llama (login del panel).
create or replace function anotar_rebotes_temporales(p_ids uuid[], p_fecha timestamptz default now())
returns integer
language sql
security invoker
set search_path = public, pg_temp
as $$
  with actualizados as (
    update contactos_newsletter
    set rebotes_temporales = rebotes_temporales + 1,
        fecha_ultimo_rebote_temporal = greatest(coalesce(fecha_ultimo_rebote_temporal, p_fecha), p_fecha)
    where id = any(p_ids)
    returning 1
  )
  select count(*)::integer from actualizados;
$$;

revoke all on function anotar_rebotes_temporales(uuid[], timestamptz) from public, anon;
grant execute on function anotar_rebotes_temporales(uuid[], timestamptz) to authenticated, service_role;
