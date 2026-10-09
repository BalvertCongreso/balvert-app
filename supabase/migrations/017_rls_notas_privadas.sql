-- BALVERT 2027 — Migración: aislar de verdad "Mis notas" por usuario
-- Ejecutar en Supabase SQL Editor (proyecto ya existente).
--
-- Antes, la política de notas_privadas solo exigía sesión iniciada
-- (auth.uid() is not null), sin comprobar de quién es la nota: el
-- aislamiento entre Ariadna y Ariosto dependía solo del filtro en pantalla
-- (NotasBoard.tsx), saltable desde las herramientas del navegador.
--
-- La tabla guarda el nombre ('Ariadna'/'Ariosto') en la columna "usuario",
-- no el email, así que la política no puede comparar auth.uid() ni
-- auth.jwt() directamente contra esa columna. La forma más simple y sin
-- tocar el resto de la app (que ya deriva la identidad del email de la
-- sesión, ver AuthContext.tsx) es comparar el email de la sesión
-- (auth.jwt() ->> 'email') contra los emails de cada persona, aquí
-- codificados directamente porque una política RLS no puede leer variables
-- de entorno de Next.js — deben coincidir con NEXT_PUBLIC_EMAIL_ARIADNA /
-- NEXT_PUBLIC_EMAIL_ARIOSTO en .env.local. Si alguna vez cambian esos
-- emails, hay que actualizar también esta política.
drop policy if exists "solo con sesión notas_privadas" on notas_privadas;

create policy "notas_privadas solo su dueño" on notas_privadas
  for all
  using (
    usuario = case lower(auth.jwt() ->> 'email')
      when 'secretaria@balvert.es' then 'Ariadna'
      when 'ariosto@balvert.es' then 'Ariosto'
      else null
    end
  )
  with check (
    usuario = case lower(auth.jwt() ->> 'email')
      when 'secretaria@balvert.es' then 'Ariadna'
      when 'ariosto@balvert.es' then 'Ariosto'
      else null
    end
  );
