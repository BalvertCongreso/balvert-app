"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import type {
  Edicion,
  Patrocinador,
  Proveedor,
  AsistenteCongreso,
  Gala,
  Excursion,
  Tarea,
  NotaCompartida,
  Categoria,
} from "@/types/database";

const euros = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

function Tarjeta({
  titulo,
  className = "",
  children,
}: {
  titulo: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border border-[var(--borde)] bg-white p-5 ${className}`}>
      <h2 className="seccion-titulo">{titulo}</h2>
      {children}
    </div>
  );
}

function Fila({ label, valor }: { label: string; valor: string | number }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-zinc-600">{label}</span>
      <span className="font-semibold text-zinc-900">{valor}</span>
    </div>
  );
}

export default function Dashboard() {
  const [cargando, setCargando] = useState(true);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [patrocinadores, setPatrocinadores] = useState<Patrocinador[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [congreso, setCongreso] = useState<AsistenteCongreso[]>([]);
  const [gala, setGala] = useState<Gala[]>([]);
  const [excursion, setExcursion] = useState<Excursion[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [notas, setNotas] = useState<NotaCompartida[]>([]);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const edicionActiva = await obtenerEdicionActiva();
      setEdicion(edicionActiva);

      const edId = edicionActiva?.id;

      const [
        { data: pat },
        { data: prov },
        { data: cong },
        { data: gal },
        { data: exc },
        { data: tar },
        { data: not },
      ] = await Promise.all([
        edId
          ? supabase.from("patrocinadores").select("*").eq("edicion_id", edId)
          : supabase.from("patrocinadores").select("*").limit(0),
        edId
          ? supabase.from("proveedores").select("*").eq("edicion_id", edId)
          : supabase.from("proveedores").select("*").limit(0),
        edId
          ? supabase.from("asistentes_congreso").select("*").eq("edicion_id", edId)
          : supabase.from("asistentes_congreso").select("*").limit(0),
        edId
          ? supabase.from("gala").select("*").eq("edicion_id", edId)
          : supabase.from("gala").select("*").limit(0),
        edId
          ? supabase.from("excursion").select("*").eq("edicion_id", edId)
          : supabase.from("excursion").select("*").limit(0),
        edId
          ? supabase.from("tareas").select("*").eq("edicion_id", edId)
          : supabase.from("tareas").select("*").limit(0),
        supabase
          .from("notas_compartidas")
          .select("*")
          .order("fecha_creacion", { ascending: false })
          .limit(5),
      ]);

      setPatrocinadores(pat ?? []);
      setProveedores(prov ?? []);
      setCongreso(cong ?? []);
      setGala(gal ?? []);
      setExcursion(exc ?? []);
      setTareas(tar ?? []);
      setNotas(not ?? []);
      setCargando(false);
    }
    cargar();
  }, []);

  // --- Patrocinadores ---
  const porCategoria = (cat: Categoria) =>
    patrocinadores.filter((p) => p.categoria === cat).length;

  // --- Facturación ---
  const facturasEmitidas = patrocinadores.filter((p) => p.factura_emitida === "Sí").length;
  const facturasEnviadas = patrocinadores.filter((p) => p.factura_enviada === "Sí").length;
  const pagosRecibidos = patrocinadores.filter((p) => p.pago_recibido === "Sí").length;
  const pagosPendientes = patrocinadores.filter((p) => p.pago_recibido !== "Sí").length;
  const totalRecaudado = patrocinadores
    .filter((p) => p.pago_recibido === "Sí")
    .reduce((sum, p) => sum + (p.precio_real_pagado ?? 0), 0);

  // --- Materiales pendientes ---
  const logosPendientes = patrocinadores.filter((p) => p.logo_recibido !== "Sí").length;
  const ponenciasPendientes = patrocinadores.filter(
    (p) => p.tiene_ponencia === "Sí" && p.ponencia_recibida !== "Sí"
  ).length;
  const invitacionesSinEnviar = patrocinadores.filter(
    (p) => p.invitaciones_enviadas === "No"
  ).length;

  // --- Mostradores y producción ---
  const conMostrador = patrocinadores.filter((p) => p.tiene_stand === "Sí").length;
  const viniladoPropio = patrocinadores.filter(
    (p) => p.vinilado_por_nuestra_cuenta === "Sí"
  ).length;
  const rollUpPropio = patrocinadores.filter(
    (p) => p.rollup_por_nuestra_cuenta === "Sí"
  ).length;

  // --- Gala ---
  const galaConfirmados = gala.filter((g) => g.confirmado === "Sí").length;
  const galaPendientes = gala.filter((g) => g.confirmado === "Pendiente").length;
  const galaMenu = (m: string) => gala.filter((g) => g.menu === m).length;
  const galaAlergias = gala.filter(
    (g) => (g.alergias_intolerancias ?? "").trim() !== ""
  ).length;

  // --- Excursión ---
  const excConfirmados = excursion.filter((e) => e.confirmado === "Sí").length;
  const excPendientes = excursion.filter((e) => e.confirmado === "Pendiente").length;
  const excCompradas = excursion.filter((e) => e.tipo_entrada === "Comprada (10€)").length;

  // --- Congreso ---
  const congConfirmados = congreso.filter((c) => c.confirmado === "Sí").length;
  const congPendientes = congreso.filter((c) => c.confirmado === "Pendiente").length;
  const congCheckIn = congreso.filter((c) => c.check_in_hecho === "Sí").length;

  // --- Tareas ---
  const tareasPorResponsable = (r: string) =>
    tareas.filter((t) => t.responsable === r && t.estado === "⏳ Pendiente").length;
  const tareasEnCurso = tareas.filter((t) => t.estado === "🔄 En curso").length;
  const tareasCompletadas = tareas.filter((t) => t.estado === "✅ Completada").length;

  // --- Económico ---
  const gananciasPatrocinadores = patrocinadores.reduce(
    (sum, p) => sum + (p.precio_real_pagado ?? p.precio_tarifa ?? 0),
    0
  );
  const gananciasGala = gala
    .filter((g) => g.tipo_entrada === "Comprada")
    .reduce((sum, g) => sum + (g.precio_entrada ?? 0), 0);
  const gananciasExcursion = excursion
    .filter((e) => e.tipo_entrada === "Comprada (10€)")
    .reduce((sum, e) => sum + (e.precio ?? 0), 0);
  const gananciasTotales = gananciasPatrocinadores + gananciasGala + gananciasExcursion;

  const gastosYaPagado = proveedores
    .filter((p) => p.factura_pagada === "Sí")
    .reduce((sum, p) => sum + (p.coste_real_pagado ?? 0), 0);
  const gastosComprometido = proveedores
    .filter((p) => p.factura_pagada !== "Sí")
    .reduce((sum, p) => sum + (p.coste_acordado ?? 0), 0);
  const gastosTotales = gastosYaPagado + gastosComprometido;

  const balanceReal = totalRecaudado - gastosYaPagado;
  const balanceProyectado = gananciasTotales - gastosTotales;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">
          Dashboard {edicion?.nombre ? `— ${edicion.nombre}` : ""}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {cargando
            ? "Calculando…"
            : edicion
            ? "Datos en tiempo real de la edición activa."
            : "No hay ninguna edición activa. Marca una edición como activa para ver el resumen."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Tarjeta titulo="Patrocinadores">
          <Fila label="Total" valor={patrocinadores.length} />
          <Fila label="💎 Diamante" valor={porCategoria("💎 DIAMANTE")} />
          <Fila label="⭐ Oro" valor={porCategoria("⭐ ORO")} />
          <Fila label="🥈 Plata" valor={porCategoria("🥈 PLATA")} />
          <Fila label="🏛 Institucional" valor={porCategoria("🏛 INSTITUCIONAL")} />
        </Tarjeta>

        <Tarjeta titulo="Facturación">
          <Fila label="Facturas emitidas" valor={facturasEmitidas} />
          <Fila label="Facturas enviadas" valor={facturasEnviadas} />
          <Fila label="Pagos recibidos" valor={pagosRecibidos} />
          <Fila label="Pagos pendientes" valor={pagosPendientes} />
          <Fila label="Total recaudado" valor={euros(totalRecaudado)} />
        </Tarjeta>

        <Tarjeta titulo="Materiales pendientes">
          <Fila label="Logos pendientes" valor={logosPendientes} />
          <Fila label="Ponencias pendientes" valor={ponenciasPendientes} />
          <Fila label="Invitaciones sin enviar" valor={invitacionesSinEnviar} />
        </Tarjeta>

        <Tarjeta titulo="Mostradores y producción">
          <Fila label="Con mostrador" valor={conMostrador} />
          <Fila label="Vinilado por nuestra cuenta" valor={viniladoPropio} />
          <Fila label="Roll up por nuestra cuenta" valor={rollUpPropio} />
        </Tarjeta>

        <Tarjeta titulo="Gala">
          <Fila label="Confirmados" valor={galaConfirmados} />
          <Fila label="Pendientes" valor={galaPendientes} />
          <Fila label="🥩 Carne" valor={galaMenu("Carne")} />
          <Fila label="🐟 Pescado" valor={galaMenu("Pescado")} />
          <Fila label="🥗 Vegetariano" valor={galaMenu("Vegetariano")} />
          <Fila label="🌱 Vegano" valor={galaMenu("Vegano")} />
          <Fila label="Con alergias/intolerancias" valor={galaAlergias} />
        </Tarjeta>

        <Tarjeta titulo="Excursión">
          <Fila label="Confirmados" valor={excConfirmados} />
          <Fila label="Pendientes" valor={excPendientes} />
          <Fila label="Entradas compradas (10€)" valor={excCompradas} />
        </Tarjeta>

        <Tarjeta titulo="Congreso">
          <Fila label="Confirmados" valor={congConfirmados} />
          <Fila label="Pendientes" valor={congPendientes} />
          <Fila label="Check-in hecho" valor={congCheckIn} />
        </Tarjeta>

        <Tarjeta titulo="Tareas">
          <Fila label="🔴 Pendientes Ariosto" valor={tareasPorResponsable("🔴 Ariosto")} />
          <Fila label="🟣 Pendientes Ariadna" valor={tareasPorResponsable("🟣 Ariadna")} />
          <Fila label="🤝 Pendientes Ambos" valor={tareasPorResponsable("🤝 Ambos")} />
          <Fila label="En curso" valor={tareasEnCurso} />
          <Fila label="Completadas" valor={tareasCompletadas} />
        </Tarjeta>

        <Tarjeta titulo="Notas compartidas" className="sm:col-span-2">
          {notas.length === 0 ? (
            <p className="text-sm text-zinc-500">Sin notas todavía.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--borde)]">
              {notas.map((n) => (
                <li key={n.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="font-semibold text-zinc-700">{n.autor}</span>
                    <span>
                      {n.fecha_creacion
                        ? new Date(n.fecha_creacion).toLocaleDateString("es-ES")
                        : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-zinc-700">
                    {(n.contenido ?? "").length > 140
                      ? `${(n.contenido ?? "").slice(0, 140)}…`
                      : n.contenido}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/notas-equipo"
            className="mt-3 inline-block text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:underline"
          >
            Ver todas →
          </Link>
        </Tarjeta>

        <Tarjeta titulo="Económico" className="sm:col-span-2 lg:col-span-3 xl:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Ganancias
          </p>
          <Fila label="Patrocinadores" valor={euros(gananciasPatrocinadores)} />
          <Fila label="Gala (entradas compradas)" valor={euros(gananciasGala)} />
          <Fila label="Excursión (entradas compradas)" valor={euros(gananciasExcursion)} />
          <Fila label="Total ganancias" valor={euros(gananciasTotales)} />

          <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Gastos (proveedores)
          </p>
          <Fila label="Ya pagado" valor={euros(gastosYaPagado)} />
          <Fila label="Comprometido pendiente" valor={euros(gastosComprometido)} />
          <Fila label="Total gastos" valor={euros(gastosTotales)} />

          <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Balance
          </p>
          <Fila label="Balance real (caja)" valor={euros(balanceReal)} />
          <Fila label="Balance proyectado" valor={euros(balanceProyectado)} />
        </Tarjeta>
      </div>
    </div>
  );
}
