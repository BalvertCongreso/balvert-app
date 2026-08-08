-- BALVERT 2027 — Esquema de base de datos (Fase 1)
-- Ejecutar completo en Supabase: Panel del proyecto > SQL Editor > New query > pegar > Run
-- Fuente: PROJECT_BRIEF.md (modelo de datos extraído del Excel BALVERT_2027_Gestion_Patrocinadores.xlsx)

create extension if not exists "pgcrypto";

-- =========================================================
-- 1. PATROCINADORES (45 campos, pestaña 🏆 PATROCINADORES)
-- =========================================================
create table if not exists patrocinadores (
  id uuid primary key default gen_random_uuid(),

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
  referencia_pago_online text
);

-- =========================================================
-- 3. EXCURSIÓN (pestaña 🚌 EXCURSIÓN) — un registro por persona asistente
-- =========================================================
create table if not exists excursion (
  id uuid primary key default gen_random_uuid(),
  empresa_entidad uuid references patrocinadores(id) on delete set null,
  categoria_patrocinio text,
  nombre_asistente text,
  cargo text,
  tipo_entrada text check (tipo_entrada in ('Incluida en patrocinio','Comprada (10€)','Invitación organización')),
  confirmado text check (confirmado in ('Sí','No','Pendiente')),
  precio numeric(10,2),
  observaciones text,
  -- Reservado para Fase 7
  metodo_pago text check (metodo_pago in ('Transferencia','Pasarela online','Otro')),
  referencia_pago_online text
);

-- =========================================================
-- 4. TAREAS (pestaña ✅ TAREAS)
-- =========================================================
create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
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
-- Seguridad (RLS)
-- Fase 1: sin login, Ariadna y Ariosto usan la misma clave pública (anon)
-- de la app y tienen acceso completo por decisión de producto.
-- El filtrado de "Mis notas" lo aplica la propia app (no es una barrera
-- de seguridad todavía), tal como se acordó para esta fase.
-- =========================================================
alter table patrocinadores enable row level security;
alter table gala enable row level security;
alter table excursion enable row level security;
alter table tareas enable row level security;
alter table tarea_comentarios enable row level security;
alter table notas_compartidas enable row level security;
alter table notas_privadas enable row level security;

create policy "acceso completo patrocinadores" on patrocinadores for all using (true) with check (true);
create policy "acceso completo gala" on gala for all using (true) with check (true);
create policy "acceso completo excursion" on excursion for all using (true) with check (true);
create policy "acceso completo tareas" on tareas for all using (true) with check (true);
create policy "acceso completo tarea_comentarios" on tarea_comentarios for all using (true) with check (true);
create policy "acceso completo notas_compartidas" on notas_compartidas for all using (true) with check (true);
create policy "acceso completo notas_privadas" on notas_privadas for all using (true) with check (true);
