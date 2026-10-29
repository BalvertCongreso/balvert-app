"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { obtenerTodasLasFilas } from "@/lib/paginarTodo";
import { leerArchivoHojaCalculo, type Hoja } from "@/lib/leerHojaCalculo";
import {
  CAMPOS_IMPORTACION,
  MAX_BYTES,
  MAX_FILAS,
  filasParaEnviar,
  prepararArchivo,
  type ArchivoContactos,
  type CampoImportacion,
  type ResumenImportacion,
} from "@/lib/importarContactos";
import { llamarApiJson } from "@/lib/apiCliente";
import { descargarExcel } from "@/lib/exportarListado";

const ORIGEN_NUEVO = "__nuevo__";

type Resultado = ResumenImportacion & { creados: number; completados: number };

function Grupo({
  titulo,
  numero,
  tono,
  children,
  extra,
}: {
  titulo: string;
  numero: number;
  tono: "verde" | "azul" | "gris" | "rojo" | "ambar";
  children: ReactNode;
  extra?: ReactNode;
}) {
  const color = {
    verde: "text-green-700",
    azul: "text-[var(--balvert-azul-oscuro)]",
    gris: "text-zinc-500",
    rojo: "text-red-700",
    ambar: "text-amber-700",
  }[tono];
  return (
    <details className="rounded-lg border border-[var(--borde)] bg-white">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-2 px-4 py-3">
        <span className={`text-xl font-bold ${color}`}>{numero}</span>
        <span className="text-sm text-zinc-700">{titulo}</span>
        {extra && <span className="ml-auto text-sm">{extra}</span>}
      </summary>
      <div className="max-h-72 overflow-auto border-t border-[var(--borde)] px-4 py-2 text-sm">
        {numero === 0 ? <p className="text-zinc-500">Ninguno.</p> : children}
      </div>
    </details>
  );
}

function Lista({ filas }: { filas: { fila: number; texto: ReactNode }[] }) {
  return (
    <table className="w-full text-left">
      <tbody>
        {filas.map((f, i) => (
          <tr key={i} className="border-t border-[var(--borde)] first:border-0">
            <td className="w-20 py-1 pr-3 text-xs text-zinc-400">Fila {f.fila}</td>
            <td className="py-1">{f.texto}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ImportarContactosPage() {
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [hojas, setHojas] = useState<Hoja[]>([]);
  const [archivo, setArchivo] = useState<ArchivoContactos | null>(null);
  const [columnas, setColumnas] = useState<(CampoImportacion | "")[]>([]);
  const [origenes, setOrigenes] = useState<string[]>([]);
  const [origenElegido, setOrigenElegido] = useState("");
  const [origenNuevo, setOrigenNuevo] = useState("");
  const [vista, setVista] = useState<ResumenImportacion | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const peticion = useRef(0);

  useEffect(() => {
    obtenerTodasLasFilas<{ origen_lista: string }>((desde, hasta) =>
      supabase
        .from("contactos_newsletter")
        .select("origen_lista")
        .not("origen_lista", "is", null)
        .order("id", { ascending: true })
        .range(desde, hasta)
    ).then(
      (filas) => setOrigenes(Array.from(new Set(filas.map((r) => r.origen_lista).filter(Boolean))).sort()),
      () => setOrigenes([])
    );
  }, []);

  const origen = (origenElegido === ORIGEN_NUEVO ? origenNuevo : origenElegido).trim();
  const hayEmail = columnas.includes("email");

  // Previsualización: la calcula el servidor con el mismo criterio que al
  // importar, sin guardar nada. Se repite al cambiar columnas u origen.
  useEffect(() => {
    if (!archivo || !hayEmail || !origen) return;
    const id = ++peticion.current;
    const temporizador = setTimeout(async () => {
      setCalculando(true);
      setError(null);
      try {
        const r: ResumenImportacion = await llamarApiJson("/api/contactos/importar", {
          filas: filasParaEnviar(archivo, columnas),
          origen,
          simular: true,
        });
        if (id === peticion.current) setVista(r);
      } catch (e) {
        if (id === peticion.current) {
          setVista(null);
          setError(e instanceof Error ? e.message : String(e));
        }
      }
      if (id === peticion.current) setCalculando(false);
    }, 400);
    return () => clearTimeout(temporizador);
  }, [archivo, columnas, origen, hayEmail]);

  function usarHoja(todas: Hoja[], nombre?: string) {
    const preparado = prepararArchivo(todas, nombre);
    if (preparado.filas.length > MAX_FILAS) {
      setArchivo(null);
      setError(`La hoja «${preparado.hoja}» tiene ${preparado.filas.length} filas; el máximo son ${MAX_FILAS}. Divide el archivo en varios.`);
      return;
    }
    setArchivo(preparado);
    setColumnas(preparado.columnas);
    setVista(null);
  }

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0];
    e.target.value = "";
    if (!elegido) return;
    setError(null);
    setResultado(null);
    setVista(null);
    setArchivo(null);
    setHojas([]);
    setNombreArchivo(elegido.name);
    if (elegido.size > MAX_BYTES) {
      setError(`El archivo pesa ${(elegido.size / 1024 / 1024).toFixed(1)} MB; el máximo son 10 MB.`);
      return;
    }
    try {
      const leidas = await leerArchivoHojaCalculo(elegido);
      setHojas(leidas);
      usarHoja(leidas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    }
  }

  function cambiarColumna(i: number, campo: CampoImportacion | "") {
    setColumnas((prev) => prev.map((c, j) => (j === i ? campo : c === campo && campo ? "" : c)));
  }

  function descargarSaltadas(saltadas: ResumenImportacion["saltadas"]) {
    if (!archivo) return;
    const porNumero = new Map(archivo.numeros.map((n, i) => [n, archivo.filas[i]]));
    const anchura = Math.max(archivo.cabeceras.length, ...archivo.filas.map((f) => f.length));
    const titulos = Array.from({ length: anchura }, (_, i) => archivo.cabeceras[i]?.trim() || `Columna ${i + 1}`);
    const filas = saltadas.map((s) => {
      const valores = porNumero.get(s.fila) ?? [];
      return { fila: s.fila, motivo: s.motivo, ...Object.fromEntries(titulos.map((_, i) => [`c${i}`, valores[i] ?? ""])) };
    });
    descargarExcel({
      filas,
      columnas: [
        { key: "fila", label: "Fila", tipo: "numero" },
        { key: "motivo", label: "Motivo" },
        ...titulos.map((t, i) => ({ key: `c${i}`, label: t })),
      ],
      pantalla: "Contactos saltados al importar",
    });
  }

  async function importar() {
    if (!archivo || !vista) return;
    const conDatos = vista.completar.length + vista.excluidos.filter((x) => x.campos.length > 0).length;
    const ok = window.confirm(
      `Se crearán ${vista.nuevos.length} contactos y se completarán datos de ${conDatos}. ¿Continuar?` +
        (vista.excluidos.length ? `\n\n${vista.excluidos.length} están excluidos de envíos y seguirán excluidos.` : "")
    );
    if (!ok) return;
    setImportando(true);
    setError(null);
    try {
      const r: Resultado = await llamarApiJson("/api/contactos/importar", {
        filas: filasParaEnviar(archivo, columnas),
        origen,
        simular: false,
      });
      setResultado(r);
      setVista(null);
      setArchivo(null);
      setHojas([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setImportando(false);
  }

  const ejemplos = (i: number) =>
    archivo
      ? archivo.filas
          .map((f) => (f[i] ?? "").trim())
          .filter(Boolean)
          .slice(0, 2)
          .join(" · ")
      : "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/contactos" className="text-sm text-[var(--balvert-azul-oscuro)] hover:underline">
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--balvert-marron)]">Importar contactos</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Sube un Excel (.xlsx) o un CSV con contactos (máximo {MAX_FILAS.toLocaleString("es-ES")} filas y 10 MB). Antes
          de guardar nada verás qué se crea y qué se completa. Si un email ya está en Contactos, solo se rellenan sus
          campos vacíos; no se pisa nada, no se borra nada y quien esté excluido de envíos sigue excluido.
        </p>
      </div>

      {resultado && (
        <section className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 p-5 text-sm text-green-800">
          <h2 className="text-base font-bold">Importación terminada</h2>
          <ul className="list-disc pl-5">
            <li>{resultado.creados} contacto(s) creados (Activos)</li>
            <li>{resultado.completar.length} completados con datos que les faltaban</li>
            <li>{resultado.sinCambios.length} ya estaban y sin cambios</li>
            <li>
              {resultado.excluidos.length} excluidos de envíos en el archivo (siguen excluidos;{" "}
              {resultado.excluidos.filter((x) => x.campos.length > 0).length} con datos completados)
            </li>
            <li>
              {resultado.saltadas.length} fila(s) saltadas
              {resultado.saltadas.length > 0 && (
                <>
                  {" — "}
                  <button type="button" className="font-semibold underline" onClick={() => descargarSaltadas(resultado.saltadas)}>
                    descargar en Excel
                  </button>
                </>
              )}
            </li>
          </ul>
          <Link href="/contactos" className="font-semibold underline">
            Ver Contactos
          </Link>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-lg border border-[var(--borde)] bg-white p-5">
        <h2 className="seccion-titulo">1. Subir el archivo</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex w-fit cursor-pointer items-center gap-3 rounded-md border border-dashed border-[var(--balvert-azul-oscuro)] bg-white px-5 py-3 text-sm font-semibold text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50">
            <span>📄 {nombreArchivo ? "Elegir otro archivo" : "Elegir archivo (.xlsx o .csv)"}</span>
            <input type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={elegirArchivo} />
          </label>
          {hojas.length > 1 && archivo && (
            <div>
              <label className="campo-label">Hoja del Excel</label>
              <select className="campo-input" value={archivo.hoja} onChange={(e) => usarHoja(hojas, e.target.value)}>
                {hojas.map((h) => (
                  <option key={h.nombre} value={h.nombre}>
                    {h.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="campo-label">Origen de la lista (obligatorio)</label>
            <select className="campo-input" value={origenElegido} onChange={(e) => setOrigenElegido(e.target.value)}>
              <option value="">Elige un origen…</option>
              {origenes.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              <option value={ORIGEN_NUEVO}>✏️ Escribir uno nuevo…</option>
            </select>
          </div>
          {origenElegido === ORIGEN_NUEVO && (
            <div>
              <label className="campo-label">Nuevo origen</label>
              <input
                className="campo-input"
                value={origenNuevo}
                onChange={(e) => setOrigenNuevo(e.target.value)}
                placeholder="Ej. «Asistentes 2026»"
              />
            </div>
          )}
        </div>
        {nombreArchivo && archivo && (
          <p className="text-sm text-zinc-600">
            <strong>{nombreArchivo}</strong> — hoja «{archivo.hoja}», {archivo.filas.length} fila(s) con datos. Si una fila
            trae su propio origen (columna «Origen de la lista»), se queda con el suyo.
          </p>
        )}
      </section>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {archivo && (
        <section className="flex flex-col gap-4 rounded-lg border border-[var(--borde)] bg-white p-5">
          <h2 className="seccion-titulo">2. Columnas</h2>
          <p className="text-sm text-zinc-600">
            Se han reconocido solas por la cabecera. Si alguna no es correcta, cámbiala.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Columna del archivo</th>
                  <th className="py-2 pr-4">Ejemplo</th>
                  <th className="py-2">Va a</th>
                </tr>
              </thead>
              <tbody>
                {columnas.map((campo, i) => (
                  <tr key={i} className="border-t border-[var(--borde)]">
                    <td className="py-2 pr-4 font-medium">{archivo.cabeceras[i]?.trim() || `(columna ${i + 1})`}</td>
                    <td className="max-w-xs truncate py-2 pr-4 text-zinc-500">{ejemplos(i) || "—"}</td>
                    <td className="py-2">
                      <select
                        className="campo-input max-w-[16rem]"
                        value={campo}
                        onChange={(e) => cambiarColumna(i, e.target.value as CampoImportacion | "")}
                        aria-label={`Campo para la columna ${archivo.cabeceras[i] ?? i + 1}`}
                      >
                        <option value="">No importar</option>
                        {CAMPOS_IMPORTACION.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!hayEmail && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Falta la columna de email: elige en «Va a» cuál es. Sin ella no se puede seguir.
            </p>
          )}
          {hayEmail && !origen && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Elige o escribe el «Origen de la lista» arriba para ver la previsualización.
            </p>
          )}
        </section>
      )}

      {archivo && hayEmail && origen && (
        <section className="flex flex-col gap-3 rounded-lg border border-[var(--borde)] bg-zinc-50 p-5">
          <h2 className="seccion-titulo">3. Previsualización (todavía no se ha guardado nada)</h2>
          {!vista ? (
            <p className="text-sm text-zinc-500">{calculando ? "Calculando…" : "—"}</p>
          ) : (
            <>
              {calculando && <p className="text-xs text-zinc-500">Recalculando…</p>}
              <Grupo titulo={`contactos nuevos que se crearán (Activos, origen «${origen}» salvo los que traen el suyo)`} numero={vista.nuevos.length} tono="verde">
                <Lista filas={vista.nuevos.map((n) => ({ fila: n.fila, texto: <>{n.email}{n.nombre && <span className="text-zinc-500"> — {n.nombre}</span>}</> }))} />
              </Grupo>
              <Grupo titulo="ya existen y se completarán sus datos vacíos" numero={vista.completar.length} tono="azul">
                <Lista filas={vista.completar.map((c) => ({ fila: c.fila, texto: <>{c.email} <span className="text-zinc-500">— se rellena: {c.campos.join(", ")}</span></> }))} />
              </Grupo>
              <Grupo titulo="ya existen y no cambian (no les falta nada de lo que trae el archivo)" numero={vista.sinCambios.length} tono="gris">
                <Lista filas={vista.sinCambios.map((c) => ({ fila: c.fila, texto: c.email }))} />
              </Grupo>
              <Grupo titulo="están excluidos de envíos: se completan sus datos vacíos, pero siguen excluidos" numero={vista.excluidos.length} tono="rojo">
                <Lista
                  filas={vista.excluidos.map((c) => ({
                    fila: c.fila,
                    texto: (
                      <>
                        {c.email} <span className="text-red-700">· Excluido ({c.motivo})</span>
                        <span className="text-zinc-500"> — {c.campos.length ? `se rellena: ${c.campos.join(", ")}` : "sin cambios"}</span>
                      </>
                    ),
                  }))}
                />
              </Grupo>
              <Grupo
                titulo="filas que se saltan"
                numero={vista.saltadas.length}
                tono="ambar"
                extra={
                  vista.saltadas.length > 0 && (
                    <button
                      type="button"
                      className="font-semibold text-[var(--balvert-azul-oscuro)] hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        descargarSaltadas(vista.saltadas);
                      }}
                    >
                      ⬇ Descargar en Excel
                    </button>
                  )
                }
              >
                <Lista filas={vista.saltadas.map((s) => ({ fila: s.fila, texto: <>{s.email || "(sin email)"} <span className="text-amber-700">— {s.motivo}</span></> }))} />
              </Grupo>
              <Grupo titulo="avisos (no impiden importar)" numero={vista.avisos.length} tono="ambar">
                <Lista filas={vista.avisos.map((a) => ({ fila: a.fila, texto: <>{a.email} <span className="text-amber-700">— {a.aviso}</span></> }))} />
              </Grupo>
              <div>
                <button
                  type="button"
                  onClick={importar}
                  disabled={importando || calculando || vista.nuevos.length + vista.completar.length + vista.excluidos.filter((x) => x.campos.length > 0).length === 0}
                  className="rounded-md px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--balvert-azul-oscuro)" }}
                >
                  {importando ? "Importando…" : "Importar"}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
