"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import { NOMBRE_EVENTO, type Tabla } from "@/lib/entradaDatos";
import { parsearQrPayload, registrarCheckin, type ResultadoCheckin } from "@/lib/checkin";
import EscanerQR from "@/components/EscanerQR";

interface ResultadoBusqueda {
  id: string;
  tabla: Tabla;
  nombre: string | null;
  detalle: string | null;
}

function formatearHora(valor: string | null | undefined): string {
  if (!valor) return "";
  return new Date(valor).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export default function CheckInPage() {
  const [resultado, setResultado] = useState<ResultadoCheckin | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState<ResultadoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);

  async function procesarDeteccion(payload: string) {
    if (procesando || resultado) return;
    setProcesando(true);
    const parseado = parsearQrPayload(payload);
    if (!parseado) {
      setResultado({ ok: false, error: "Este código no es una entrada de BALVERT." });
      setProcesando(false);
      return;
    }
    const res = await registrarCheckin(supabase, parseado.tabla, { qr_codigo: parseado.codigo });
    setResultado(res);
    setProcesando(false);
  }

  async function marcarDesdeBusqueda(item: ResultadoBusqueda) {
    setProcesando(true);
    const res = await registrarCheckin(supabase, item.tabla, { id: item.id });
    setResultado(res);
    setBusqueda("");
    setResultadosBusqueda([]);
    setProcesando(false);
  }

  async function buscarManual(texto: string) {
    setBusqueda(texto);
    if (!texto.trim()) {
      setResultadosBusqueda([]);
      return;
    }
    setBuscando(true);
    const edicionActiva = await obtenerEdicionActiva();
    const filtro = `%${texto.trim()}%`;

    let queryCongreso = supabase
      .from("asistentes_congreso")
      .select("id, nombre, email")
      .or(`nombre.ilike.${filtro},email.ilike.${filtro}`)
      .limit(6);
    let queryGala = supabase
      .from("gala")
      .select("id, nombre_asistente, email_asistente")
      .or(`nombre_asistente.ilike.${filtro},email_asistente.ilike.${filtro}`)
      .limit(6);
    let queryExcursion = supabase
      .from("excursion")
      .select("id, nombre_asistente, email_asistente")
      .or(`nombre_asistente.ilike.${filtro},email_asistente.ilike.${filtro}`)
      .limit(6);

    if (edicionActiva) {
      queryCongreso = queryCongreso.eq("edicion_id", edicionActiva.id);
      queryGala = queryGala.eq("edicion_id", edicionActiva.id);
      queryExcursion = queryExcursion.eq("edicion_id", edicionActiva.id);
    }

    const [congreso, gala, excursion] = await Promise.all([queryCongreso, queryGala, queryExcursion]);

    const items: ResultadoBusqueda[] = [
      ...(congreso.data ?? []).map((r) => ({
        id: r.id as string,
        tabla: "congreso" as Tabla,
        nombre: r.nombre as string | null,
        detalle: r.email as string | null,
      })),
      ...(gala.data ?? []).map((r) => ({
        id: r.id as string,
        tabla: "gala" as Tabla,
        nombre: r.nombre_asistente as string | null,
        detalle: r.email_asistente as string | null,
      })),
      ...(excursion.data ?? []).map((r) => ({
        id: r.id as string,
        tabla: "excursion" as Tabla,
        nombre: r.nombre_asistente as string | null,
        detalle: r.email_asistente as string | null,
      })),
    ];
    setResultadosBusqueda(items);
    setBuscando(false);
  }

  function siguiente() {
    setResultado(null);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Check-in</h1>
        <p className="text-sm text-zinc-600">
          Escanea la entrada QR de cada asistente al llegar. Funciona para Congreso, Gala y
          Excursión con un mismo escáner.
        </p>
      </div>

      {!resultado && <EscanerQR pausado={procesando} onDetectado={procesarDeteccion} />}

      {procesando && !resultado && (
        <p className="text-center text-sm text-zinc-500">Comprobando…</p>
      )}

      {resultado && (
        <div
          className={`rounded-lg border p-5 text-center ${
            !resultado.ok
              ? "border-red-200 bg-red-50"
              : resultado.yaEstaba
              ? "border-amber-200 bg-amber-50"
              : "border-green-200 bg-green-50"
          }`}
        >
          {!resultado.ok ? (
            <>
              <p className="text-lg font-bold text-red-700">QR no válido</p>
              <p className="mt-1 text-sm text-red-700">{resultado.error}</p>
            </>
          ) : (
            <>
              <p
                className={`text-lg font-bold ${
                  resultado.yaEstaba ? "text-amber-800" : "text-green-800"
                }`}
              >
                {resultado.yaEstaba ? "Ya había hecho check-in" : "Check-in registrado"}
              </p>
              <p className="mt-2 text-xl font-semibold">
                {resultado.nombre || "(sin nombre)"}
              </p>
              <p className="text-sm text-zinc-600">{resultado.evento}</p>
              {resultado.empresa && (
                <p className="mt-1 text-sm text-zinc-600">
                  {resultado.empresa}
                  {resultado.categoriaPatrocinio ? ` · ${resultado.categoriaPatrocinio}` : ""}
                </p>
              )}
              {resultado.detalleLabel && resultado.detalleValor && (
                <p className="mt-1 text-sm text-zinc-600">
                  {resultado.detalleLabel}: {resultado.detalleValor}
                </p>
              )}
              {resultado.yaEstaba && resultado.checkInFechaAnterior && (
                <p className="mt-2 text-xs text-amber-700">
                  Entrada validada por primera vez a las{" "}
                  {formatearHora(resultado.checkInFechaAnterior)}
                </p>
              )}
            </>
          )}
          <button
            onClick={siguiente}
            className="mt-4 rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--balvert-azul-oscuro)" }}
          >
            Escanear siguiente
          </button>
        </div>
      )}

      {!resultado && (
        <div>
          <label className="campo-label">¿No lee el QR? Busca por nombre o email</label>
          <input
            type="text"
            className="campo-input"
            placeholder="Escribe para buscar…"
            value={busqueda}
            onChange={(e) => buscarManual(e.target.value)}
          />
          {busqueda.trim() && (
            <div className="mt-2 rounded-md border border-[var(--borde)] bg-white">
              {buscando && <p className="px-3 py-2 text-xs text-zinc-400">Buscando…</p>}
              {!buscando && resultadosBusqueda.length === 0 && (
                <p className="px-3 py-2 text-xs text-zinc-400">Sin resultados.</p>
              )}
              {resultadosBusqueda.map((item) => (
                <button
                  key={`${item.tabla}-${item.id}`}
                  type="button"
                  disabled={procesando}
                  onClick={() => marcarDesdeBusqueda(item)}
                  className="flex w-full items-center justify-between border-t border-[var(--borde)] px-3 py-2 text-left text-sm hover:bg-zinc-50 disabled:opacity-60"
                >
                  <span>
                    {item.nombre || "(sin nombre)"}
                    {item.detalle && (
                      <span className="ml-2 text-xs text-zinc-500">{item.detalle}</span>
                    )}
                  </span>
                  <span className="text-xs font-medium text-[var(--balvert-azul-oscuro)]">
                    {NOMBRE_EVENTO[item.tabla]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
