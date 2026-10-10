"use client";

import { useEffect, useState } from "react";
import { obtenerEdicionActiva } from "@/lib/edicionActiva";
import { llamarApiGet, llamarApiJson } from "@/lib/apiCliente";
import {
  MAX_INTRODUCCION,
  MAX_TITULO,
  NOMBRE_PUBLICO,
  PUBLICOS,
  TIPOS_PREGUNTA,
  opcionesDe,
  type Encuesta,
  type Pregunta,
  type Publico,
  type Respuestas,
  type TipoPregunta,
} from "@/lib/encuestas";
import { descargarCsv, descargarExcel, type ColumnaExport } from "@/lib/exportarListado";
import FormularioEncuesta from "@/components/FormularioEncuesta";
import type { Edicion } from "@/types/database";

type PreguntaGuardada = Pregunta & { id: string };

interface Estado {
  destinatarios: number;
  nuevos: number;
  total_envios: number;
  enviados: number;
  por_enviar: number;
  respondidos: number;
  sin_responder: number;
  recordatorios_por_enviar: number;
  emails_hoy: number;
  limite_diario: number;
}

interface Datos {
  encuesta: Encuesta;
  preguntas: PreguntaGuardada[];
  estado: Estado;
  respuestas: { respuestas: Respuestas; fecha: string }[];
}

// Pregunta en edición: `clave` solo sirve para React y la vista previa;
// `opcionesTexto` es el cuadro de opciones (una por línea).
interface PreguntaEditable {
  clave: string;
  texto: string;
  tipo: TipoPregunta;
  opcionesTexto: string;
  obligatoria: boolean;
}

const aEditable = (p: PreguntaGuardada): PreguntaEditable => ({
  clave: p.id,
  texto: p.texto,
  tipo: p.tipo,
  opcionesTexto: (p.opciones ?? []).join("\n"),
  obligatoria: p.obligatoria,
});

const aPregunta = (p: PreguntaEditable): PreguntaGuardada => ({
  id: p.clave,
  texto: p.texto.trim(),
  tipo: p.tipo,
  opciones:
    p.tipo === "opcion_unica"
      ? p.opcionesTexto
          .split("\n")
          .map((o) => o.trim())
          .filter(Boolean)
      : null,
  obligatoria: p.obligatoria,
});

export default function CuestionariosPage() {
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [publico, setPublico] = useState<Publico>("asistentes");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  // Edición
  const [titulo, setTitulo] = useState("");
  const [introduccion, setIntroduccion] = useState("");
  const [preguntas, setPreguntas] = useState<PreguntaEditable[]>([]);
  const [cambios, setCambios] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(false);

  function aplicarDatos(d: Datos) {
    setDatos(d);
    setTitulo(d.encuesta.titulo);
    setIntroduccion(d.encuesta.introduccion ?? "");
    setPreguntas(d.preguntas.map(aEditable));
    setCambios(false);
    setError(null);
    setCargando(false);
  }

  function fallo(e: unknown) {
    setError(e instanceof Error ? e.message : "Error inesperado.");
    setCargando(false);
  }

  useEffect(() => {
    obtenerEdicionActiva().then(setEdicion);
  }, []);

  // Al abrir la pantalla y al cambiar de pestaña (quien cambia de pestaña ya
  // pone "cargando").
  useEffect(() => {
    let vigente = true;
    llamarApiGet(`/api/encuestas?publico=${publico}`)
      .then((d: Datos) => vigente && aplicarDatos(d))
      .catch((e) => vigente && fallo(e));
    return () => {
      vigente = false;
    };
  }, [publico]);

  async function recargar() {
    try {
      aplicarDatos(await llamarApiGet(`/api/encuestas?publico=${publico}`));
    } catch (e) {
      fallo(e);
    }
  }

  function cambiarPestana(p: Publico) {
    if (p === publico) return;
    if (cambios && !window.confirm("Tienes cambios sin guardar en este cuestionario. ¿Salir sin guardarlos?")) return;
    setMensaje(null);
    setVistaPrevia(false);
    setDatos(null);
    setCargando(true);
    setPublico(p);
  }

  const enviada = !!datos?.encuesta.enviada_en;
  const cerrada = !!datos?.encuesta.cerrada;

  function editarPregunta(i: number, cambio: Partial<PreguntaEditable>) {
    setPreguntas((lista) => lista.map((p, j) => (j === i ? { ...p, ...cambio } : p)));
    setCambios(true);
  }
  function moverPregunta(i: number, delta: -1 | 1) {
    setPreguntas((lista) => {
      const j = i + delta;
      if (j < 0 || j >= lista.length) return lista;
      const copia = [...lista];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
    setCambios(true);
  }
  function quitarPregunta(i: number) {
    if (!window.confirm(`¿Quitar la pregunta ${i + 1}?`)) return;
    setPreguntas((lista) => lista.filter((_, j) => j !== i));
    setCambios(true);
  }
  function anadirPregunta() {
    setPreguntas((lista) => [
      ...lista,
      { clave: crypto.randomUUID(), texto: "", tipo: "escala_1_5", opcionesTexto: "", obligatoria: true },
    ]);
    setCambios(true);
  }

  async function accion(cuerpo: Record<string, unknown>, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setTrabajando(true);
    setMensaje(null);
    try {
      const r = await llamarApiJson("/api/encuestas", { publico, ...cuerpo });
      await recargar();
      setMensaje(r.mensaje ?? "Hecho.");
    } catch (e) {
      setMensaje("⚠️ " + (e instanceof Error ? e.message : "Error inesperado."));
    }
    setTrabajando(false);
  }

  function guardar() {
    return accion({
      accion: "guardar",
      titulo,
      introduccion,
      ...(!enviada && { preguntas: preguntas.map(aPregunta) }),
    });
  }

  const estado = datos?.estado;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--balvert-marron)]">Cuestionarios de satisfacción</h1>
        <p className="text-sm text-zinc-600">
          Se responden en una página de BALVERT con un enlace personal. Las respuestas son anónimas: se sabe quién ha
          contestado (para no mandarle recordatorio), pero no qué ha contestado cada persona.
          {edicion?.nombre && (
            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              Edición: {edicion.nombre}
            </span>
          )}
        </p>
      </div>

      <div className="flex gap-1 border-b border-[var(--borde)]">
        {PUBLICOS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => cambiarPestana(p)}
            className={`-mb-px rounded-t-md border px-4 py-2 text-sm font-semibold ${
              p === publico
                ? "border-[var(--borde)] border-b-white bg-white text-[var(--balvert-marron)]"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {NOMBRE_PUBLICO[p]}
          </button>
        ))}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {cargando && !datos && <p className="text-sm text-zinc-500">Cargando…</p>}
      {mensaje && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            mensaje.startsWith("⚠️") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {mensaje}
        </p>
      )}

      {datos && estado && (
        <>
          {/* ---------- Envío ---------- */}
          <section className="flex flex-col gap-3 rounded-lg border border-[var(--borde)] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="seccion-titulo">Envío</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  cerrada
                    ? "bg-zinc-200 text-zinc-700"
                    : enviada
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {cerrada ? "Cerrado" : enviada ? "Enviado · acepta respuestas" : "Borrador · sin enviar"}
              </span>
            </div>

            <p className="text-sm text-zinc-600">
              {publico === "asistentes"
                ? "Destinatarios: asistentes del Congreso de esta edición con el check-in hecho (un email por persona aunque tenga varias inscripciones)."
                : "Destinatarios: contacto 1 y contacto 2 de cada patrocinador de esta edición (un email por persona aunque sea contacto de varias empresas)."}
            </p>

            {enviada && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Cifra etiqueta="Enviados" valor={estado.enviados} />
                <Cifra etiqueta="Han contestado" valor={estado.respondidos} />
                <Cifra etiqueta="Sin contestar" valor={estado.sin_responder} />
                <Cifra etiqueta="Por salir" valor={estado.por_enviar + estado.recordatorios_por_enviar} />
              </div>
            )}

            {(estado.por_enviar > 0 || estado.recordatorios_por_enviar > 0) && (
              <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-[var(--balvert-azul-oscuro)]">
                Enviados {estado.enviados} de {estado.total_envios}
                {estado.recordatorios_por_enviar > 0 && ` · ${estado.recordatorios_por_enviar} recordatorio(s) pendientes`}
                . El resto saldrá solo mañana (y los días siguientes si hace falta): como mucho se mandan{" "}
                {estado.limite_diario} emails de cuestionarios al día por el límite de Resend. Hoy van {estado.emails_hoy}.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {!enviada && (
                <BotonAccion
                  disabled={trabajando || cerrada || estado.destinatarios === 0 || cambios}
                  title={cambios ? "Guarda los cambios antes de enviar" : undefined}
                  onClick={() =>
                    accion(
                      { accion: "enviar" },
                      `¿Enviar el cuestionario a ${estado.destinatarios} persona(s)?\n\nDespués de enviarlo, las preguntas ya no se podrán cambiar (sí el título y la introducción).`
                    )
                  }
                  principal
                >
                  Enviar a {estado.destinatarios} persona{estado.destinatarios === 1 ? "" : "s"}
                </BotonAccion>
              )}
              {enviada && !cerrada && estado.nuevos > 0 && (
                <BotonAccion
                  disabled={trabajando}
                  onClick={() =>
                    accion(
                      { accion: "enviar" },
                      `Hay ${estado.nuevos} persona(s) que cumplen las condiciones y aún no lo han recibido (p. ej. check-in posterior o contacto nuevo). ¿Enviárselo?`
                    )
                  }
                  principal
                >
                  Enviar a {estado.nuevos} persona{estado.nuevos === 1 ? "" : "s"} nueva{estado.nuevos === 1 ? "" : "s"}
                </BotonAccion>
              )}
              {enviada && !cerrada && (
                <BotonAccion
                  disabled={trabajando || estado.sin_responder === 0}
                  onClick={() =>
                    accion(
                      { accion: "recordatorio" },
                      `¿Enviar un recordatorio a las ${estado.sin_responder} persona(s) que no han contestado?`
                    )
                  }
                >
                  Enviar recordatorio a los {estado.sin_responder} que no han contestado
                </BotonAccion>
              )}
              {enviada && (
                <BotonAccion
                  disabled={trabajando}
                  onClick={() =>
                    cerrada
                      ? accion({ accion: "reabrir" }, "¿Volver a abrir el cuestionario para que acepte respuestas?")
                      : accion(
                          { accion: "cerrar" },
                          "¿Cerrar el cuestionario? Dejará de aceptar respuestas (los enlaces mostrarán que está cerrado) y no saldrán más emails."
                        )
                  }
                >
                  {cerrada ? "Volver a abrir" : "Cerrar cuestionario"}
                </BotonAccion>
              )}
            </div>
            {!enviada && estado.destinatarios === 0 && (
              <p className="text-xs text-zinc-500">Ahora mismo no hay nadie que cumpla las condiciones.</p>
            )}
          </section>

          {/* ---------- Preguntas ---------- */}
          <section className="flex flex-col gap-4 rounded-lg border border-[var(--borde)] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="seccion-titulo">Cuestionario</h2>
              <button
                type="button"
                onClick={() => setVistaPrevia((v) => !v)}
                className="rounded-md border border-[var(--borde)] px-3 py-1.5 text-sm font-semibold text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50"
              >
                {vistaPrevia ? "Volver a editar" : "👁 Vista previa"}
              </button>
            </div>

            {vistaPrevia ? (
              <div className="mx-auto w-full max-w-2xl rounded-lg border border-dashed border-[var(--borde)] p-4 sm:p-6">
                <p className="mb-4 text-xs text-zinc-500">
                  Así lo verá quien responda (puedes probar a marcar respuestas; aquí no se envía nada).
                </p>
                <FormularioEncuesta
                  key={JSON.stringify(preguntas)}
                  titulo={titulo}
                  introduccion={introduccion || null}
                  preguntas={preguntas.map(aPregunta)}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="campo-label">Título</label>
                  <input
                    className="campo-input"
                    maxLength={MAX_TITULO}
                    value={titulo}
                    onChange={(e) => {
                      setTitulo(e.target.value);
                      setCambios(true);
                    }}
                  />
                </div>
                <div>
                  <label className="campo-label">Introducción</label>
                  <textarea
                    className="campo-input min-h-20"
                    maxLength={MAX_INTRODUCCION}
                    value={introduccion}
                    onChange={(e) => {
                      setIntroduccion(e.target.value);
                      setCambios(true);
                    }}
                  />
                </div>

                {enviada && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    🔒 El cuestionario ya se ha enviado: las preguntas están bloqueadas para que los resultados sean
                    coherentes. Puedes cambiar el título y la introducción.
                  </p>
                )}

                <ol className="flex flex-col gap-3">
                  {preguntas.map((p, i) =>
                    enviada ? (
                      <li key={p.clave} className="rounded-md border border-[var(--borde)] px-4 py-3 text-sm">
                        <span className="font-semibold">
                          {i + 1}. {p.texto}
                        </span>
                        <span className="ml-2 text-xs text-zinc-500">
                          {TIPOS_PREGUNTA.find((t) => t.valor === p.tipo)?.etiqueta}
                          {p.obligatoria ? " · obligatoria" : " · opcional"}
                          {p.tipo === "opcion_unica" && ` · ${aPregunta(p).opciones?.join(" / ")}`}
                        </span>
                      </li>
                    ) : (
                      <li key={p.clave} className="flex flex-col gap-2 rounded-md border border-[var(--borde)] p-4">
                        <div className="flex items-start gap-2">
                          <span className="mt-2 w-6 shrink-0 text-sm font-semibold text-zinc-500">{i + 1}.</span>
                          <input
                            className="campo-input"
                            placeholder="Texto de la pregunta"
                            value={p.texto}
                            onChange={(e) => editarPregunta(i, { texto: e.target.value })}
                          />
                          <div className="flex shrink-0 gap-1">
                            <BotonIcono titulo="Subir" disabled={i === 0} onClick={() => moverPregunta(i, -1)}>
                              ↑
                            </BotonIcono>
                            <BotonIcono
                              titulo="Bajar"
                              disabled={i === preguntas.length - 1}
                              onClick={() => moverPregunta(i, 1)}
                            >
                              ↓
                            </BotonIcono>
                            <BotonIcono titulo="Quitar" onClick={() => quitarPregunta(i)}>
                              ✕
                            </BotonIcono>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 pl-8">
                          <select
                            className="campo-input w-auto"
                            value={p.tipo}
                            onChange={(e) => editarPregunta(i, { tipo: e.target.value as TipoPregunta })}
                          >
                            {TIPOS_PREGUNTA.map((t) => (
                              <option key={t.valor} value={t.valor}>
                                {t.etiqueta}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-2 text-sm text-zinc-700">
                            <input
                              type="checkbox"
                              checked={p.obligatoria}
                              onChange={(e) => editarPregunta(i, { obligatoria: e.target.checked })}
                            />
                            Obligatoria
                          </label>
                        </div>
                        {p.tipo === "opcion_unica" && (
                          <div className="pl-8">
                            <label className="campo-label">Opciones (una por línea)</label>
                            <textarea
                              className="campo-input min-h-24"
                              value={p.opcionesTexto}
                              onChange={(e) => editarPregunta(i, { opcionesTexto: e.target.value })}
                            />
                          </div>
                        )}
                      </li>
                    )
                  )}
                </ol>

                {!enviada && (
                  <button
                    type="button"
                    onClick={anadirPregunta}
                    className="self-start rounded-md border border-dashed border-[var(--balvert-azul-oscuro)] px-4 py-2 text-sm font-semibold text-[var(--balvert-azul-oscuro)] hover:bg-sky-50"
                  >
                    + Añadir pregunta
                  </button>
                )}
              </>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--borde)] pt-4">
              <BotonAccion disabled={trabajando || !cambios} onClick={guardar} principal>
                {trabajando ? "Guardando…" : "Guardar cambios"}
              </BotonAccion>
              {cambios && (
                <>
                  <span className="text-sm text-amber-700">Hay cambios sin guardar.</span>
                  <button
                    type="button"
                    className="text-sm text-zinc-500 underline"
                    onClick={() => {
                      setTitulo(datos.encuesta.titulo);
                      setIntroduccion(datos.encuesta.introduccion ?? "");
                      setPreguntas(datos.preguntas.map(aEditable));
                      setCambios(false);
                    }}
                  >
                    Descartar
                  </button>
                </>
              )}
            </div>
          </section>

          {/* ---------- Resultados ---------- */}
          <Resultados datos={datos} edicion={edicion?.nombre ?? null} />
        </>
      )}
    </div>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-md bg-zinc-50 px-3 py-2">
      <p className="text-xl font-bold text-zinc-800">{valor}</p>
      <p className="text-xs text-zinc-500">{etiqueta}</p>
    </div>
  );
}

function BotonAccion({
  children,
  onClick,
  disabled,
  principal,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  principal?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
        principal
          ? "bg-[var(--balvert-azul-oscuro)] text-white hover:opacity-90"
          : "border border-[var(--borde)] bg-white text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function BotonIcono({
  children,
  onClick,
  disabled,
  titulo,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  titulo: string;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={disabled}
      className="h-9 w-9 rounded-md border border-[var(--borde)] text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

// ---------- Resultados ----------

function Resultados({ datos, edicion }: { datos: Datos; edicion: string | null }) {
  const { preguntas, respuestas, estado, encuesta } = datos;
  const total = respuestas.length;

  async function descargar(formato: "xlsx" | "csv") {
    // Solo fecha (día) y respuestas: ningún email ni identificador.
    const filas = respuestas.map((r) => ({ fecha: r.fecha, ...r.respuestas }));
    const columnas: ColumnaExport<Record<string, unknown>>[] = [
      { key: "fecha", label: "Fecha (día)" },
      ...preguntas.map((p, i) => ({ key: p.id, label: `${i + 1}. ${p.texto}` })),
    ];
    const opciones = {
      filas,
      columnas,
      pantalla: `Cuestionario ${NOMBRE_PUBLICO[encuesta.publico]}`,
      edicion,
      // Respuestas de preguntas que ya no existen (no debería haber).
      excluir: Object.keys(Object.assign({}, ...filas)).filter(
        (k) => k !== "fecha" && !preguntas.some((p) => p.id === k)
      ),
    };
    try {
      if (formato === "xlsx") await descargarExcel(opciones);
      else descargarCsv(opciones);
    } catch (e) {
      alert("No se pudo generar el archivo: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-[var(--borde)] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="seccion-titulo">Resultados</h2>
          <p className="text-sm text-zinc-600">
            {total} respuesta{total === 1 ? "" : "s"} recibida{total === 1 ? "" : "s"} de {estado.enviados} enviado
            {estado.enviados === 1 ? "" : "s"}
            {estado.enviados > 0 && ` (${Math.round((total / estado.enviados) * 100)} %)`}
          </p>
        </div>
        <div className="flex gap-2">
          <BotonAccion disabled={total === 0} onClick={() => descargar("xlsx")}>
            ⬇ Excel
          </BotonAccion>
          <BotonAccion disabled={total === 0} onClick={() => descargar("csv")}>
            ⬇ CSV
          </BotonAccion>
        </div>
      </div>

      {total === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no hay respuestas.</p>
      ) : (
        preguntas.map((p, i) => {
          const valores = respuestas.map((r) => r.respuestas[p.id]).filter((v) => v !== undefined && v !== "");
          return (
            <div key={p.id} className="border-t border-[var(--borde)] pt-4">
              <p className="mb-2 text-sm font-semibold text-zinc-800">
                {i + 1}. {p.texto}
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  {valores.length} respuesta{valores.length === 1 ? "" : "s"}
                </span>
              </p>
              {p.tipo === "escala_1_5" && <ResultadoEscala valores={valores as number[]} />}
              {(p.tipo === "si_no_quiza" || p.tipo === "opcion_unica") && (
                <Barras
                  filas={opcionesDe(p).map((o) => ({ etiqueta: o, n: valores.filter((v) => v === o).length }))}
                  total={valores.length}
                />
              )}
              {p.tipo === "texto" &&
                (valores.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sin respuestas.</p>
                ) : (
                  <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                    {(valores as string[]).map((t, j) => (
                      <li key={j} className="whitespace-pre-line rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                        {t}
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          );
        })
      )}
    </section>
  );
}

function ResultadoEscala({ valores }: { valores: number[] }) {
  if (valores.length === 0) return <p className="text-sm text-zinc-500">Sin respuestas.</p>;
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-zinc-700">
        Media: <strong className="text-lg text-[var(--balvert-marron)]">{media.toFixed(1).replace(".", ",")}</strong> / 5
      </p>
      <Barras
        filas={[5, 4, 3, 2, 1].map((n) => ({ etiqueta: String(n), n: valores.filter((v) => v === n).length }))}
        total={valores.length}
      />
    </div>
  );
}

function Barras({ filas, total }: { filas: { etiqueta: string; n: number }[]; total: number }) {
  return (
    <div className="flex max-w-xl flex-col gap-1.5">
      {filas.map((f) => {
        const pct = total > 0 ? (f.n / total) * 100 : 0;
        return (
          <div key={f.etiqueta} className="flex items-center gap-2 text-sm">
            <span className="w-28 shrink-0 truncate text-zinc-600" title={f.etiqueta}>
              {f.etiqueta}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-zinc-100">
              <div className="h-full rounded bg-[var(--balvert-azul)]" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-20 shrink-0 text-right tabular-nums text-zinc-600">
              {f.n} ({Math.round(pct)} %)
            </span>
          </div>
        );
      })}
    </div>
  );
}
