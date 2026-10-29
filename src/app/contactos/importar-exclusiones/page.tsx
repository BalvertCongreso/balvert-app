"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { leerArchivoHojaCalculo } from "@/lib/leerHojaCalculo";
import { analizarArchivo, sucesosDesdeArchivo, type ArchivoAnalizado } from "@/lib/importarExclusiones";
import {
  aplicarSucesos,
  cargarContactosPorEmail,
  type ResumenExclusiones,
} from "@/lib/exclusiones";
import { descargarCsv, descargarExcel } from "@/lib/exportarListado";
import type { MotivoExclusion } from "@/types/database";

type Contactos = Awaited<ReturnType<typeof cargarContactosPorEmail>>;

const MOTIVOS: { valor: MotivoExclusion; texto: string }[] = [
  { valor: "Rebote", texto: "Rebote" },
  { valor: "Baja", texto: "Baja" },
  { valor: "Manual", texto: "Manual" },
];

function Cifra({ valor, texto, tono }: { valor: number; texto: string; tono?: "rojo" | "ambar" | "gris" }) {
  const color =
    tono === "rojo" ? "text-red-700" : tono === "ambar" ? "text-amber-700" : tono === "gris" ? "text-zinc-500" : "text-[var(--balvert-marron)]";
  return (
    <div className="rounded-lg border border-[var(--borde)] bg-white p-4">
      <p className={`text-2xl font-bold ${color}`}>{valor}</p>
      <p className="text-sm text-zinc-600">{texto}</p>
    </div>
  );
}

export default function ImportarExclusionesPage() {
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<ArchivoAnalizado | null>(null);
  const [motivo, setMotivo] = useState<MotivoExclusion>("Rebote");
  const [soloSi, setSoloSi] = useState(true);
  const [contactos, setContactos] = useState<Contactos | null>(null);
  const [vista, setVista] = useState<ResumenExclusiones | null>(null);
  const [resultado, setResultado] = useState<ResumenExclusiones | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  useEffect(() => {
    cargarContactosPorEmail(supabase)
      .then(setContactos)
      .catch((e) => setError("No se pudieron cargar los contactos: " + (e instanceof Error ? e.message : String(e))));
  }, []);

  const filasUsadas = archivo
    ? archivo.filas.filter((f) => !(archivo.columnaSigue && soloSi) || f.sigueEnContactos === true).length
    : 0;
  const filasSinCategoria = archivo
    ? archivo.filas.filter((f) => !(archivo.columnaSigue && soloSi) || f.sigueEnContactos === true).filter((f) => !f.categoria).length
    : 0;

  // Previsualización: la misma cuenta que al aplicar, sin guardar nada.
  useEffect(() => {
    if (!archivo || !contactos) return;
    let cancelado = false;
    const sucesos = sucesosDesdeArchivo(archivo, { motivo, soloSigueEnContactos: Boolean(archivo.columnaSigue) && soloSi });
    aplicarSucesos(supabase, sucesos, { simular: true, contactos }).then(
      (r) => {
        if (!cancelado) setVista(r);
      },
      (e) => {
        if (!cancelado) setError(e instanceof Error ? e.message : String(e));
      }
    );
    return () => {
      cancelado = true;
    };
  }, [archivo, contactos, motivo, soloSi]);

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0];
    if (!elegido) return;
    setError(null);
    setResultado(null);
    setVista(null);
    setArchivo(null);
    setNombreArchivo(elegido.name);
    setTrabajando("Leyendo el archivo…");
    try {
      const analizado = analizarArchivo(await leerArchivoHojaCalculo(elegido));
      setArchivo(analizado);
      setSoloSi(Boolean(analizado.columnaSigue));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    }
    setTrabajando(null);
    e.target.value = "";
  }

  async function aplicar() {
    if (!archivo || !vista || !contactos) return;
    const aExcluir = vista.excluidos.Rebote + vista.excluidos.Baja + vista.excluidos.Manual;
    const ok = window.confirm(
      `Se van a aplicar los cambios a Contactos:\n\n` +
        `· ${aExcluir} pasan a «Excluido de envíos» (Rebote ${vista.excluidos.Rebote}, Baja ${vista.excluidos.Baja}, Manual ${vista.excluidos.Manual})\n` +
        `· ${vista.rebotesTemporales} rebotes temporales se anotan (siguen activos)\n\n` +
        `No se crea ni se borra ningún contacto. ¿Aplicar?`
    );
    if (!ok) return;
    setTrabajando("Aplicando…");
    setError(null);
    try {
      const sucesos = sucesosDesdeArchivo(archivo, { motivo, soloSigueEnContactos: Boolean(archivo.columnaSigue) && soloSi });
      const r = await aplicarSucesos(supabase, sucesos);
      setResultado(r);
      setArchivo(null);
      setVista(null);
      setContactos(await cargarContactosPorEmail(supabase));
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : "No se pudo aplicar.") +
          " Puede que una parte sí se haya aplicado: vuelve a subir el archivo y mira la previsualización."
      );
    }
    setTrabajando(null);
  }

  function descargarNoEncontrados(formato: "xlsx" | "csv") {
    if (!vista) return;
    const opciones = {
      filas: vista.noEnContactos.map((email) => ({ email })),
      columnas: [{ key: "email", label: "Email" }],
      pantalla: "Exclusiones no encontradas en Contactos",
    };
    if (formato === "xlsx") descargarExcel(opciones);
    else descargarCsv(opciones);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/contactos" className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline">
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">Importar exclusiones</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Sube un Excel (.xlsx) o un CSV con los emails que no deben recibir más boletines (rebotes, bajas…).
          Antes de cambiar nada verás cuántos coinciden con Contactos. No se crea ni se borra ningún contacto: los
          que coinciden quedan como «Excluido de envíos» con su motivo.
        </p>
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-3 rounded-md border border-dashed border-[var(--balvert-azul-oscuro)] bg-white px-5 py-4 text-sm font-semibold text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50">
        <span>📄 {nombreArchivo ? "Elegir otro archivo" : "Elegir archivo (.xlsx o .csv)"}</span>
        <input type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={elegirArchivo} />
      </label>

      {trabajando && <p className="text-sm text-zinc-600">{trabajando}</p>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {resultado && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          Hecho. {resultado.excluidos.Rebote + resultado.excluidos.Baja + resultado.excluidos.Manual} contacto(s) han
          pasado a «Excluido de envíos» (Rebote {resultado.excluidos.Rebote}, Baja {resultado.excluidos.Baja}, Manual{" "}
          {resultado.excluidos.Manual}) y se han anotado {resultado.rebotesTemporales} rebote(s) temporal(es).{" "}
          <Link href="/contactos" className="font-semibold underline">
            Ver Contactos
          </Link>
        </div>
      )}

      {archivo && (
        <section className="flex flex-col gap-4 rounded-lg border border-[var(--borde)] bg-white p-5">
          <h2 className="seccion-titulo">1. Lo que trae el archivo</h2>
          <p className="text-sm text-zinc-700">
            <strong>{nombreArchivo}</strong> — hoja «{archivo.hoja}». Emails en la columna «{archivo.columnaEmail}».{" "}
            {archivo.columnaCategoria
              ? `Categoría de rebote en «${archivo.columnaCategoria}»: los valores «soft» o «temporal» se tratan como rebote temporal (solo se anotan) y el resto como rebote.`
              : "No trae columna de categoría de rebote."}
            {archivo.invalidas > 0 && ` ${archivo.invalidas} fila(s) no tienen un email válido y se ignoran.`}
          </p>

          {archivo.columnaSigue && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={soloSi} onChange={(e) => setSoloSi(e.target.checked)} />
              Usar solo las filas con «Sí» en «{archivo.columnaSigue}» (
              {archivo.filas.filter((f) => f.sigueEnContactos === true).length} de {archivo.filas.length} filas)
            </label>
          )}

          {(!archivo.columnaCategoria || filasSinCategoria > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {archivo.columnaCategoria
                  ? `Motivo para las ${filasSinCategoria} fila(s) sin categoría de rebote:`
                  : "Motivo para todo el archivo:"}
              </span>
              <select
                className="campo-input max-w-[10rem]"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoExclusion)}
              >
                {MOTIVOS.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.texto}
                  </option>
                ))}
              </select>
            </div>
          )}

          <h2 className="seccion-titulo mt-2">2. Previsualización (todavía no se ha cambiado nada)</h2>
          {!vista ? (
            <p className="text-sm text-zinc-500">Calculando…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Cifra valor={filasUsadas} texto={`filas con email (${vista.emails} emails distintos)`} tono="gris" />
                <Cifra
                  valor={vista.excluidos.Rebote + vista.excluidos.Baja + vista.excluidos.Manual}
                  texto={`coinciden con Contactos y pasarán a Excluido — Rebote ${vista.excluidos.Rebote} · Baja ${vista.excluidos.Baja} · Manual ${vista.excluidos.Manual}`}
                  tono="rojo"
                />
                <Cifra valor={vista.rebotesTemporales} texto="rebotes temporales se anotarán (siguen activos)" tono="ambar" />
                <Cifra valor={vista.yaExcluidos} texto="ya estaban excluidos (no cambian)" tono="gris" />
                <Cifra valor={vista.noEnContactos.length} texto="no están en Contactos (no se crean)" tono="gris" />
              </div>
              {vista.noEnContactos.length > 0 && (
                <p className="text-sm">
                  Lista de los que no están en Contactos:{" "}
                  <button type="button" className="font-semibold text-[var(--balvert-azul-oscuro)] hover:underline" onClick={() => descargarNoEncontrados("xlsx")}>
                    descargar Excel
                  </button>{" "}
                  ·{" "}
                  <button type="button" className="font-semibold text-[var(--balvert-azul-oscuro)] hover:underline" onClick={() => descargarNoEncontrados("csv")}>
                    CSV
                  </button>
                </p>
              )}
              <div>
                <button
                  type="button"
                  onClick={aplicar}
                  disabled={Boolean(trabajando) || vista.excluidos.Rebote + vista.excluidos.Baja + vista.excluidos.Manual + vista.rebotesTemporales === 0}
                  className="rounded-md px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--balvert-azul-oscuro)" }}
                >
                  Aplicar
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
