-- BALVERT 2027 — Esquema de base de datos (Fase 1)
-- Ejecutar completo en Supabase: Panel del proyecto > SQL Editor > New query > pegar > Run
-- Fuente: PROJECT_BRIEF.md (modelo de datos extraído del Excel BALVERT_2027_Gestion_Patrocinadores.xlsx)

create extension if not exists "pgcrypto";

-- =========================================================
-- 0. EDICIONES (multi-edición: la app se reutiliza cada año)
-- =========================================================
create table if not exists ediciones (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  anio integer,
  fecha_inicio date,
  fecha_fin date,
  ciudad text,
  activa boolean not null default false,

  -- Fase 2B: lugar y horario propios de cada evento (no comparten sede).
  -- Vacíos hasta que se cierren; mientras tanto la entrada muestra "Por confirmar".
  lugar_congreso text,
  fecha_hora_congreso timestamp,
  lugar_gala text,
  fecha_hora_gala timestamp,
  lugar_excursion text,
  fecha_hora_excursion timestamp
);

-- =========================================================
-- 1. PATROCINADORES (45 campos, pestaña 🏆 PATROCINADORES)
-- =========================================================
create table if not exists patrocinadores (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid references ediciones(id),

  -- Identificación
  categoria text check (categoria in ('💎 DIAMANTE','⭐ ORO','🥈 PLATA','🏛 INSTITUCIONAL','Personalizado')),
  empresa_entidad text,
  nombre_comercial_cartel text,

  -- Contacto (dos personas)
  contacto1_nombre text,
  contacto1_cargo text,
  contacto1_email text,
  contacto1_telefono text,
  contacto2_nombre text,
  contacto2_cargo text,
  contacto2_email text,
  contacto2_telefono text,

  -- Invitaciones
  num_invitaciones_incluidas integer,
  nombres_invitados text,
  emails_invitados text,
  invitaciones_enviadas text check (invitaciones_enviadas in ('Sí','No','N/A')),

  -- Ponencia
  tiene_ponencia text check (tiene_ponencia in ('Sí','No','N/A')),
  ponente_nombre text,
  ponente_cargo text,
  ponencia_titulo text,
  ponencia_duracion_min integer,
  ponencia_recibida text check (ponencia_recibida in ('Sí','No')),

  -- Mostrador (columnas heredadas del Excel con nombre "stand"; la interfaz siempre debe mostrar "Mostrador")
  tiene_stand text check (tiene_stand in ('Sí','No','N/A')),
  vinilado_por_nuestra_cuenta text check (vinilado_por_nuestra_cuenta in ('Sí','No')),
  rollup_por_nuestra_cuenta text check (rollup_por_nuestra_cuenta in ('Sí','No')),
  necesidades_stand text,

  -- Logo y materiales
  logo_recibido text check (logo_recibido in ('Sí','No')),
  formato_logo text check (formato_logo in ('AI (vector)','PNG alta res','JPG','Pendiente')),
  fecha_limite_materiales date,

  -- Facturación
  razon_social_facturacion text,
  cif_nif text,
  direccion_fiscal text,
  email_contabilidad text,
  canal_especial_facturacion text check (canal_especial_facturacion in ('No','FACe','eFACtura','Otro')),
  fecha_facturacion_solicitada date,
  precio_tarifa numeric(10,2),
  precio_real_pagado numeric(10,2),
  factura_emitida text check (factura_emitida in ('Sí','No')),
  fecha_emision_factura date,
  factura_enviada text check (factura_enviada in ('Sí','No')),
  pago_recibido text check (pago_recibido in ('Sí','No')),
  fecha_pago date,
  -- Reservado para Fase 7 (pasarela de pagos online). No se usa activamente en Fase 1.
  metodo_pago text check (metodo_pago in ('Transferencia','Pasarela online','Otro')),
  referencia_pago_online text,

  -- Beneficios y notas
  beneficios_incluidos text,
  beneficios_excluidos text,
  observaciones text
);

comment on column patrocinadores.tiene_stand is 'Mostrar en interfaz como "Mostrador"';
comment on column patrocinadores.metodo_pago is 'Reservado Fase 7 (pasarela de pagos online)';
comment on column patrocinadores.referencia_pago_online is 'Reservado Fase 7 (id de transacción, ej. Stripe)';

-- =========================================================
-- 2. GALA (pestaña 🍽 GALA) — un registro por persona asistente
-- =========================================================
create table if not exists gala (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid references ediciones(id),
  empresa_entidad uuid references patrocinadores(id) on delete set null,
  categoria_patrocinio text,
  nombre_asistente text,
  email_asistente text,
  cargo text,
  tipo_entrada text check (tipo_entrada in ('Incluida en patrocinio','Comprada','Invitación organización')),
  menu text check (menu in ('Carne','Pescado','Vegetariano','Vegano')),
  -- Dato sensible (salud, RGPD categoría especial): tratar con cuidado, no exportar sin necesidad.
  alergias_intolerancias text,
  confirmado text check (confirmado in ('Sí','No','Pendiente')),
  entrada_enviada text check (entrada_enviada in ('Sí','No')),
  precio_entrada numeric(10,2),
  observaciones text,
  -- Reservado para Fase 7
  metodo_pago text check (metodo_pago in ('Transferencia','Pasarela online','Otro')),
  referencia_pago_online text,
  -- Fase 2B: identificador único del QR de la entrada, para validar en el check-in (Fase 3).
  qr_codigo text unique,
  -- Fase 3: si esta entrada ya se validó físicamente en la puerta, y cuándo.
  check_in_hecho text check (check_in_hecho in ('Sí','No')) default 'No',
  check_in_fecha timestamptz
);

-- =========================================================
-- 2B. ASISTENTES_CONGRESO (NUEVO — Fase 2A, no existía en el Excel ni en Berrly)
-- Un registro por persona física que asiste al congreso (independiente,
-- invitado por patrocinio, o contacto de empresa patrocinadora).
-- =========================================================
create table if not exists asistentes_congreso (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid references ediciones(id),
  -- Nullable a propósito: las "invitaciones vacías" que crea Patrocinadores
  -- son plazas reservadas sin nombre todavía (se rellena más adelante).
  nombre text,
  email text,
  telefono text,
  cargo text,
  empresa_entidad uuid references patrocinadores(id) on delete set null,
  categoria_patrocinio text,
  tipo_acceso text check (tipo_acceso in ('Independiente','Invitado por patrocinio','Contacto de empresa patrocinadora')),
  menu text check (menu in ('Carne','Pescado','Vegetariano','Vegano')),
  -- Dato sensible (salud, RGPD categoría especial): tratar con cuidado, no exportar sin necesidad.
  alergias_intolerancias text,
  confirmado text check (confirmado in ('Sí','No','Pendiente')),
  entrada_enviada text check (entrada_enviada in ('Sí','No')),
  precio numeric(10,2),
  -- Reservado para Fase 7
  metodo_pago text check (metodo_pago in ('Transferencia','Pasarela online','Otro')),
  referencia_pago_online text,
  observaciones text,
  -- Fase 2B: identificador único del QR de la entrada, para validar en el check-in (Fase 3).
  qr_codigo text unique,
  -- Fase 3: si esta entrada ya se validó físicamente en la puerta, y cuándo.
  check_in_hecho text check (check_in_hecho in ('Sí','No')) default 'No',
  check_in_fecha timestamptz,
  -- Fase 2C-ii: como mucho una fila por email dentro de la misma edición
  -- (evita duplicados del formulario público). Los email nulos —invitaciones
  -- vacías creadas desde Patrocinadores— no cuentan como duplicados entre sí.
  unique (email, edicion_id)
);

-- =========================================================
-- 3. EXCURSIÓN (pestaña 🚌 EXCURSIÓN) — un registro por persona asistente
-- Nota: email_asistente y entrada_enviada NO estaban en el Excel original;
-- se añadieron en Fase 2B (con aprobación de Ariadna) para poder mandar la
-- entrada QR por email igual que en Congreso y Gala.
-- =========================================================
create table if not exists excursion (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid references ediciones(id),
  empresa_entidad uuid references patrocinadores(id) on delete set null,
  categoria_patrocinio text,
  nombre_asistente text,
  email_asistente text,
  cargo text,
  tipo_entrada text check (tipo_entrada in ('Incluida en patrocinio','Comprada (10€)','Invitación organización')),
  confirmado text check (confirmado in ('Sí','No','Pendiente')),
  entrada_enviada text check (entrada_enviada in ('Sí','No')),
  precio numeric(10,2),
  observaciones text,
  -- Reservado para Fase 7
  metodo_pago text check (metodo_pago in ('Transferencia','Pasarela online','Otro')),
  referencia_pago_online text,
  -- Fase 2B: identificador único del QR de la entrada, para validar en el check-in (Fase 3).
  qr_codigo text unique,
  -- Fase 3: si esta entrada ya se validó físicamente en la puerta, y cuándo.
  check_in_hecho text check (check_in_hecho in ('Sí','No')) default 'No',
  check_in_fecha timestamptz
);

-- =========================================================
-- 4. TAREAS (pestaña ✅ TAREAS)
-- =========================================================
create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid references ediciones(id),
  responsable text check (responsable in ('🔴 Ariosto','🟣 Ariadna','🤝 Ambos')),
  tarea text,
  entidad_relacionada uuid references patrocinadores(id) on delete set null,
  fase text check (fase in ('Fase 0 - Cierre 2026','Fase 1 - Jul/Ago 2026','Fase 2 - Sep/Nov 2026','Fase 3 - Dic 2026/Ene 2027','Fase 4 - Feb 2027','Fase 5 - Congreso','General')),
  prioridad text check (prioridad in ('🔴 Alta','🟡 Media','🟢 Baja')),
  fecha_limite date,
  estado text check (estado in ('⏳ Pendiente','🔄 En curso','✅ Completada','❌ Cancelada')),
  fecha_completada date,
  notas text
);

-- =========================================================
-- 4B. PROVEEDORES (NUEVO — Fase 1B, control de gasto/coste)
-- Lo contrario de PATROCINADORES: aquí pagamos nosotros, no nos pagan a nosotros.
-- =========================================================
create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid references ediciones(id),

  -- Identificación y contacto
  nombre_proveedor text,
  servicio_prestado text,
  persona_contacto text,
  email_contacto text,
  telefono_contacto text,

  -- Evento
  evento_vinculado text check (evento_vinculado in ('Congreso','Gala','Excursión','General/Todo el evento')),

  -- Coste y facturación
  coste_acordado numeric(10,2),
  coste_real_pagado numeric(10,2),
  numero_factura text,
  factura_recibida text check (factura_recibida in ('Sí','No')),
  fecha_recepcion_factura date,
  factura_pagada text check (factura_pagada in ('Sí','No')),
  fecha_pago date,
  forma_pago text check (forma_pago in ('Transferencia','Otro')),

  -- Condiciones y notas
  condiciones_servicio text,
  observaciones text
);

-- =========================================================
-- 4C. CONTACTOS_NEWSLETTER (NUEVO — Fase 4, boletines por email)
-- Lista general de contactos (ponentes, prensa, interesados...), sin
-- edicion_id a propósito: no está ligada a una edición ni a un patrocinador.
-- =========================================================
create table if not exists contactos_newsletter (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  apellidos text,
  email text unique,
  telefono text,
  origen_lista text,
  fecha_alta timestamptz default now()
);

-- =========================================================
-- 5. TAREA_COMENTARIOS (hilo de comentarios por tarea)
-- =========================================================
create table if not exists tarea_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid references tareas(id) on delete cascade,
  autor text check (autor in ('Ariosto','Ariadna')),
  contenido text,
  fecha_creacion timestamptz default now()
);

-- =========================================================
-- 6. NOTAS_COMPARTIDAS (tablón único, ambos ven y escriben)
-- =========================================================
create table if not exists notas_compartidas (
  id uuid primary key default gen_random_uuid(),
  autor text check (autor in ('Ariadna','Ariosto')),
  contenido text,
  fecha_creacion timestamptz default now(),
  fecha_actualizacion timestamptz default now()
);

-- =========================================================
-- 7. NOTAS_PRIVADAS (cada usuario ve únicamente las suyas)
-- =========================================================
create table if not exists notas_privadas (
  id uuid primary key default gen_random_uuid(),
  usuario text check (usuario in ('Ariadna','Ariosto')),
  contenido text,
  fecha_creacion timestamptz default now(),
  fecha_actualizacion timestamptz default now()
);

-- =========================================================
-- 8. PROSPECTOS_PATROCINIO (Fase 6c — Captación, embudo de patrocinadores potenciales)
-- Distinto de PATROCINADORES: aquí son empresas/entidades a las que se está
-- intentando captar, todavía sin confirmar. La conversión a Patrocinadores
-- es manual (Ariadna/Ariosto crean la ficha ellos mismos), nunca automática.
-- =========================================================
create table if not exists prospectos_patrocinio (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid references ediciones(id),
  empresa_entidad text,
  contacto_nombre text,
  contacto_cargo text,
  contacto_email text,
  contacto_telefono text,
  interes text check (interes in ('Sin contactar','Contactado','Interesado','En negociación','No interesado','Convertido en patrocinador')),
  responsable text check (responsable in ('🔴 Ariosto','🟣 Ariadna','🤝 Ambos')),
  observaciones text
);

-- =========================================================
-- 9. PROSPECTOS_CONTACTOS (historial de contactos por prospecto, mismo patrón que tarea_comentarios)
-- =========================================================
create table if not exists prospectos_contactos (
  id uuid primary key default gen_random_uuid(),
  prospecto_id uuid references prospectos_patrocinio(id) on delete cascade,
  fecha timestamptz default now(),
  autor text check (autor in ('Ariosto','Ariadna')),
  comentario text
);

-- =========================================================
-- Seguridad (RLS)
-- Login real con Supabase Auth (desde antes de la Fase 2C): todas las
-- tablas internas exigen sesión iniciada (auth.uid() is not null), ya no
-- basta con tener la clave pública "anon" de la app.
-- El filtrado de "Mis notas" lo sigue aplicando también la propia app
-- (a qué usuario le pertenece cada nota), esto solo exige estar logueado.
-- =========================================================
alter table ediciones enable row level security;
alter table patrocinadores enable row level security;
alter table gala enable row level security;
alter table excursion enable row level security;
alter table tareas enable row level security;
alter table proveedores enable row level security;
alter table asistentes_congreso enable row level security;
alter table tarea_comentarios enable row level security;
alter table notas_compartidas enable row level security;
alter table notas_privadas enable row level security;
alter table contactos_newsletter enable row level security;
alter table prospectos_patrocinio enable row level security;
alter table prospectos_contactos enable row level security;

create policy "solo con sesión ediciones" on ediciones for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión contactos_newsletter" on contactos_newsletter for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión patrocinadores" on patrocinadores for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión gala" on gala for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión excursion" on excursion for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión tareas" on tareas for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión proveedores" on proveedores for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión asistentes_congreso" on asistentes_congreso for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión tarea_comentarios" on tarea_comentarios for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión notas_compartidas" on notas_compartidas for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión notas_privadas" on notas_privadas for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión prospectos_patrocinio" on prospectos_patrocinio for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "solo con sesión prospectos_contactos" on prospectos_contactos for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Permisos a nivel de base de datos: sin esto, la clave anon recibe
-- "permission denied" aunque las políticas de arriba digan que sí se puede.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- =========================================================
-- Fase 2C-ii: formulario público de inscripción al Congreso.
-- Se probó primero dando a "anon" permiso de INSERT/UPDATE limitado por RLS,
-- pero se topó con un caso límite de Postgres en el que el UPDATE público no
-- combinaba bien con la política "solo con sesión" (confirmado con pruebas
-- diagnósticas: datos y permisos correctos, pero la fila no aparecía ni con
-- las políticas aisladas). En su lugar, la ruta del formulario público
-- (src/app/api/inscripcion-congreso) usa la clave "service_role" solo en el
-- servidor —nunca en el navegador— y valida a mano, en el propio código, qué
-- se puede guardar. Por eso `asistentes_congreso` y `ediciones` NO tienen
-- ninguna política pública: siguen exigiendo sesión real en todo, como el
-- resto de tablas.
-- =========================================================
-- Primera edición (para que la app tenga una edición activa desde el minuto uno)
-- =========================================================
insert into ediciones (nombre, anio, activa)
select 'BALVERT 2027', 2027, true
where not exists (select 1 from ediciones);
