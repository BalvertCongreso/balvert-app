"use client";

import { useRef, useState } from "react";
import {
  BUCKET_ARCHIVOS_PATROCINADOR,
  FORMATOS_PERMITIDOS,
  MAX_COMENTARIO_ARCHIVO,
  MENSAJE_DEMASIADO_GRANDE,
  NOMBRE_TIPO_ARCHIVO,
  TAMANO_MAXIMO_ARCHIVO,
  TIPOS_ARCHIVO_PORTAL,
  TIPO_POR_EXTENSION,
  extensionDe,
  type TipoArchivo,
  type TipoArchivoPortal,
} from "@/lib/patrocinadorArchivos";

// Pestañas "Mi patrocinio" y "Material" de /portal/inicio, y los documentos
// que el equipo comparte con cada empresa. Todo pasa por
// /api/portal/materiales/*, que comprueba con la sesión que la empresa es suya.

interface ArchivoSubido {
  id: string;
  tipo: TipoArchivo;
  nombre: string;
  creado: string;
  email: string | null;
  comentario: string | null;
}

export interface ArchivoOrganizacion {
  id: string;
  tipo: TipoArchivo;
  titulo: string | null;
  nombre: string;
  creado: string;
}

interface Ponente {
  ponente_nombre: string | null;
  ponente_cargo: string | null;
  ponencia_titulo: string | null;
  ponencia_duracion_min: number | null;
}

export interface EmpresaMaterial {
  id: string;
  empresa: string | null;
  categoria: string | null;
  incluye: string | null;
  particularesIncluidos: string | null;
  particularesExcluidos: string | null;
  estado: {
    logoRecibido: boolean;
    tienePonencia: boolean;
    ponenciaRecibida: boolean;
    fechaLimite: string | null;
  };
  produccion: {
    precioRollup: number | null;
    precioVinilado: number | null;
    texto: string | null;
    rollupsSolicitados: number;
    rollupPorNuestraCuenta: boolean;
    vinilado: boolean;
  };
  ponente: Ponente | null;
  subidos: ArchivoSubido[];
  organizacion: ArchivoOrganizacion[];
}

export async function obtenerMateriales(): Promise<EmpresaMaterial[]> {
  const res = await fetch("/api/portal/materiales", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo cargar la información de tu empresa. Recarga la página.");
  return data.empresas;
}

const MAX_ROLLUPS = 99;
const ACEPTADOS = Object.keys(TIPO_POR_EXTENSION).map((e) => `.${e}`).join(",");

const euros = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

async function enviarJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Tu sesión ha caducado. Recarga la página y vuelve a entrar con tu email.");
  if (!res.ok) throw new Error(data.error || "No se ha podido guardar. Inténtalo de nuevo en un momento.");
  return data;
}

// ---- Piezas de interfaz comunes ----

export function Aviso({ tipo, children }: { tipo: "error" | "ok" | "info"; children: React.ReactNode }) {
  const estilos = {
    error: "border-red-200 bg-red-50 text-red-700",
    ok: "border-green-200 bg-green-50 text-green-800",
    info: "border-[var(--borde)] bg-zinc-50 text-zinc-700",
  }[tipo];
  return <div className={`rounded-md border p-3 text-sm ${estilos}`}>{children}</div>;
}

function Bloque({ titulo, ayuda, children }: { titulo: string; ayuda?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--borde)] p-4">
      <h3 className="text-base font-semibold text-[var(--balvert-marron)]">{titulo}</h3>
      {ayuda && <p className="mt-1 text-sm text-zinc-600">{ayuda}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Etiqueta({ bien, children }: { bien: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        bien ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {children}
    </span>
  );
}

const botonPrincipal =
  "min-h-11 rounded-md bg-[var(--balvert-azul-oscuro)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";
const botonSecundario =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--borde)] px-4 py-2 text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50";

// ---- Pestaña "Mi patrocinio" ----

export function SeccionPatrocinio({ e, recargar }: { e: EmpresaMaterial; recargar: () => void }) {
  const hayParticulares = Boolean(e.particularesIncluidos || e.particularesExcluidos);
  return (
    <div className="flex flex-col gap-4">
      <Bloque titulo="Qué incluye tu patrocinio">
        {e.incluye ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">{e.incluye}</p>
        ) : (
          <p className="text-sm text-zinc-600">
            Todavía no hemos puesto aquí el detalle de tu patrocinio. Si lo necesitas, escríbenos y te lo enviamos.
          </p>
        )}
        {hayParticulares && (
          <div className="mt-4 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
            <p className="mb-1 font-semibold">Condiciones particulares de tu empresa</p>
            {e.particularesIncluidos && <p className="whitespace-pre-line">{e.particularesIncluidos}</p>}
            {e.particularesExcluidos && (
              <p className="mt-2 whitespace-pre-line">
                <span className="font-medium">No incluye: </span>
                {e.particularesExcluidos}
              </p>
            )}
          </div>
        )}
      </Bloque>
      <Produccion e={e} onGuardado={recargar} />
    </div>
  );
}

function Produccion({ e, onGuardado }: { e: EmpresaMaterial; onGuardado: () => void }) {
  const p = e.produccion;
  const [rollups, setRollups] = useState(String(p.rollupsSolicitados));
  const [vinilado, setVinilado] = useState(p.vinilado);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!p.precioRollup && !p.precioVinilado) return null;

  const numRollups = Number(rollups);
  const rollupsValido = rollups !== "" && Number.isInteger(numRollups) && numRollups >= 0 && numRollups <= MAX_ROLLUPS;
  const cambiaRollups = Boolean(p.precioRollup) && rollupsValido && numRollups !== p.rollupsSolicitados;
  const cambiaVinilado = Boolean(p.precioVinilado) && vinilado !== p.vinilado;

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setOk(null);
    if (p.precioRollup && !rollupsValido) {
      setError(`Escribe cuántos rollups quieres con un número entero entre 0 y ${MAX_ROLLUPS}.`);
      return;
    }
    // Confirmación con lo que se pide y su importe.
    const pedir: string[] = [];
    const anular: string[] = [];
    if (cambiaRollups && p.precioRollup) {
      if (numRollups > 0) {
        pedir.push(`${numRollups} rollup${numRollups === 1 ? "" : "s"} por ${euros(numRollups * p.precioRollup)} + IVA`);
      } else {
        anular.push("tu pedido de rollups");
      }
    }
    if (cambiaVinilado && p.precioVinilado) {
      if (vinilado) pedir.push(`el vinilado del mostrador por ${euros(p.precioVinilado)} + IVA`);
      else anular.push("el vinilado del mostrador");
    }
    const frases = [
      ...(pedir.length ? [`pedir ${pedir.join(" y ")}`] : []),
      ...(anular.length ? [`anular ${anular.join(" y ")}`] : []),
    ];
    const mensaje = `Vas a ${frases.join(" y a ")}.${pedir.length ? " Se incluirá en tu factura." : ""} ¿Confirmas?`;
    if (!window.confirm(mensaje)) return;

    setGuardando(true);
    try {
      await enviarJson("/api/portal/materiales/produccion", {
        patrocinador_id: e.id,
        ...(p.precioRollup ? { rollups: numRollups } : {}),
        ...(p.precioVinilado ? { vinilado } : {}),
      });
      setOk("Pedido guardado. Nos llega un aviso y te escribiremos si necesitamos algo más.");
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar. Inténtalo de nuevo en un momento.");
    }
    setGuardando(false);
  }

  return (
    <Bloque
      titulo="Producción de rollup y vinilado"
      ayuda="Si quieres, te fabricamos los rollups y/o el vinilado del mostrador. Los precios no incluyen IVA. No se paga aquí: lo añadiremos a tu factura."
    >
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {p.precioRollup && (
          <span>
            Rollups pedidos: <Etiqueta bien={p.rollupsSolicitados > 0}>{p.rollupsSolicitados}</Etiqueta>
          </span>
        )}
        {p.precioVinilado && (
          <span>
            Vinilado: <Etiqueta bien={p.vinilado}>{p.vinilado ? "Pedido" : "No pedido"}</Etiqueta>
          </span>
        )}
      </div>
      {p.texto && <p className="mb-4 whitespace-pre-line rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">{p.texto}</p>}
      <form onSubmit={guardar} className="flex flex-col gap-5">
        {p.precioRollup && (
          <div>
            <label className="campo-label" htmlFor={`rollups-${e.id}`}>
              ¿Cuántos rollups quieres que te fabriquemos?
            </label>
            <p className="mb-2 text-xs text-zinc-500">
              Rollup de 150 × 200 cm, {euros(p.precioRollup)} + IVA cada uno. Pon 0 si no quieres ninguno.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                id={`rollups-${e.id}`}
                type="number"
                min={0}
                max={MAX_ROLLUPS}
                step={1}
                inputMode="numeric"
                className="campo-input w-24 text-base"
                value={rollups}
                onChange={(ev) => setRollups(ev.target.value)}
              />
              <span className="text-sm text-zinc-700">
                {rollupsValido ? (
                  <>
                    Total: <strong>{euros(numRollups * p.precioRollup)} + IVA</strong>
                  </>
                ) : (
                  `Un número entre 0 y ${MAX_ROLLUPS}`
                )}
              </span>
            </div>
          </div>
        )}
        {p.precioVinilado && (
          <label className="flex items-start gap-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5"
              checked={vinilado}
              onChange={(ev) => setVinilado(ev.target.checked)}
            />
            <span>
              Quiero que me hagáis el vinilado del mostrador: <strong>{euros(p.precioVinilado)} + IVA</strong>, precio cerrado
              por el mostrador completo.
            </span>
          </label>
        )}
        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        <div>
          <button type="submit" disabled={guardando || (!cambiaRollups && !cambiaVinilado)} className={botonPrincipal}>
            {guardando ? "Guardando…" : "Guardar mi pedido"}
          </button>
          {!cambiaRollups && !cambiaVinilado && !guardando && (
            <p className="mt-2 text-xs text-zinc-500">Cambia la cantidad o la casilla para poder guardar.</p>
          )}
        </div>
      </form>
    </Bloque>
  );
}

// ---- Pestaña "Material" ----

const TEXTO_TIPO: Record<TipoArchivoPortal, { opcion: string; ayuda: string; recibido: string }> = {
  logo: {
    opcion: "Logo",
    ayuda: "Mejor en vectorial (AI, EPS, SVG o PDF). Si no lo tienes, envíanos un PNG en alta resolución.",
    recibido: "Logo recibido",
  },
  ponencia: {
    opcion: "Ponencia (presentación)",
    ayuda: "La presentación de tu ponencia en PowerPoint (PPTX o PPT), Keynote (KEY) o PDF.",
    recibido: "Ponencia recibida",
  },
  rollup: {
    opcion: "Diseño del rollup",
    ayuda: "El diseño para tu rollup de 150 × 200 cm. Si quieres que te lo fabriquemos, pídelo en la pestaña «Mi patrocinio».",
    recibido: "Diseño del rollup recibido",
  },
  vinilado: {
    opcion: "Diseño del vinilado",
    ayuda: "El diseño para vinilar el mostrador (las medidas están en la pestaña «Mi patrocinio», donde también puedes pedirlo).",
    recibido: "Diseño del vinilado recibido",
  },
};

function FechaLimite({ iso }: { iso: string }) {
  // Días completos entre hoy y la fecha límite (las dos a medianoche).
  const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const limite = new Date(anio, mes - 1, dia);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((limite.getTime() - hoy.getTime()) / 86400000);
  const texto = limite.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  if (dias < 0) {
    return (
      <Aviso tipo="error">
        La fecha límite para enviarnos el material era el <strong>{texto}</strong>. Si aún te falta algo, envíanoslo cuanto
        antes o escríbenos.
      </Aviso>
    );
  }
  if (dias < 15) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>Envíanos el material antes del {texto}.</strong>{" "}
        {dias === 0 ? "¡Es hoy!" : `Quedan ${dias} día${dias === 1 ? "" : "s"}.`}
      </div>
    );
  }
  return <Aviso tipo="info">Envíanos el material antes del {texto}.</Aviso>;
}

function ponenteCompleto(p: Ponente | null) {
  return Boolean(p && p.ponente_nombre && p.ponente_cargo && p.ponencia_titulo && p.ponencia_duracion_min);
}

export function SeccionMaterial({
  e,
  recargar,
  irAPatrocinio,
}: {
  e: EmpresaMaterial;
  recargar: () => void;
  irAPatrocinio: () => void;
}) {
  const p = e.produccion;
  return (
    <div className="flex flex-col gap-4">
      {e.estado.fechaLimite && <FechaLimite iso={e.estado.fechaLimite} />}

      <Bloque titulo="Tu material de un vistazo">
        <ul className="flex flex-col gap-2 text-sm text-zinc-700">
          <li className="flex items-center justify-between gap-3">
            Logo <Etiqueta bien={e.estado.logoRecibido}>{e.estado.logoRecibido ? "Recibido" : "Pendiente"}</Etiqueta>
          </li>
          {e.estado.tienePonencia && (
            <>
              <li className="flex items-center justify-between gap-3">
                Ponencia{" "}
                <Etiqueta bien={e.estado.ponenciaRecibida}>{e.estado.ponenciaRecibida ? "Recibida" : "Pendiente"}</Etiqueta>
              </li>
              <li className="flex items-center justify-between gap-3">
                Datos del ponente{" "}
                <Etiqueta bien={ponenteCompleto(e.ponente)}>{ponenteCompleto(e.ponente) ? "Completos" : "Faltan datos"}</Etiqueta>
              </li>
            </>
          )}
          {p.precioRollup && (
            <li className="flex items-center justify-between gap-3">
              Rollups pedidos <Etiqueta bien={p.rollupsSolicitados > 0}>{p.rollupsSolicitados}</Etiqueta>
            </li>
          )}
          {p.precioVinilado && (
            <li className="flex items-center justify-between gap-3">
              Vinilado del mostrador <Etiqueta bien={p.vinilado}>{p.vinilado ? "Pedido" : "No pedido"}</Etiqueta>
            </li>
          )}
        </ul>
        {(p.precioRollup || p.precioVinilado) && (
          <p className="mt-3 text-xs text-zinc-500">
            Los rollups y el vinilado se piden en la pestaña{" "}
            <button type="button" onClick={irAPatrocinio} className="font-medium text-[var(--balvert-azul-oscuro)] underline">
              Mi patrocinio
            </button>
            .
          </p>
        )}
      </Bloque>

      <Subir e={e} onSubido={recargar} />
      <Subidos e={e} onBorrado={recargar} />
      {e.ponente && <DatosPonente e={e} ponente={e.ponente} onGuardado={recargar} />}
    </div>
  );
}

// Sube el archivo directamente al bucket con la URL firmada de un solo uso,
// con XHR para poder enseñar el progreso. El tipo lo decide el servidor por
// la extensión (el navegador suele dejarlo vacío en AI/EPS/KEY).
function subirConProgreso(ruta: string, token: string, archivo: File, tipo: string, onProgreso: (pct: number) => void) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const camino = ruta.split("/").map(encodeURIComponent).join("/");
  const url = `${base}/storage/v1/object/upload/sign/${BUCKET_ARCHIVOS_PATROCINADOR}/${camino}?token=${encodeURIComponent(token)}`;
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", clave);
    xhr.setRequestHeader("Authorization", `Bearer ${clave}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("Content-Type", tipo);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgreso(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      const grande = xhr.status === 413 || /size|large|exceed/i.test(xhr.responseText);
      reject(
        new Error(
          grande ? MENSAJE_DEMASIADO_GRANDE : "No se ha podido subir el archivo. Comprueba tu conexión e inténtalo de nuevo."
        )
      );
    };
    xhr.onerror = () => reject(new Error("Se ha cortado la conexión mientras se subía el archivo. Inténtalo de nuevo."));
    xhr.send(new Blob([archivo], { type: tipo }));
  });
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--balvert-azul-oscuro)] text-sm font-bold text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-sm font-semibold text-zinc-800">{titulo}</p>
        {children}
      </div>
    </div>
  );
}

function Subir({ e, onSubido }: { e: EmpresaMaterial; onSubido: () => void }) {
  const [tipo, setTipo] = useState<TipoArchivoPortal>("logo");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [comentario, setComentario] = useState("");
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Comprobación al elegir el archivo, para avisar antes de pulsar Enviar.
  function problemaArchivo(f: File): string | null {
    if (!TIPO_POR_EXTENSION[extensionDe(f.name)]) {
      return `Este tipo de archivo no se puede subir. Formatos aceptados: ${FORMATOS_PERMITIDOS}.`;
    }
    if (f.size > TAMANO_MAXIMO_ARCHIVO) {
      return "Este archivo pesa más de 50 MB. Envíalo por WeTransfer a secretaria@balvert.es.";
    }
    return null;
  }

  function elegirArchivo(f: File | null) {
    setOk(null);
    setArchivo(f);
    setError(f ? problemaArchivo(f) : null);
  }

  async function subir(ev: React.FormEvent) {
    ev.preventDefault();
    if (!archivo) return;
    setOk(null);
    const problema = problemaArchivo(archivo);
    setError(problema);
    if (problema) return;
    setProgreso(0);
    try {
      const { ruta, token, tipo: tipoMime } = await enviarJson("/api/portal/materiales/subida", {
        patrocinador_id: e.id,
        tipo,
        nombre: archivo.name,
        tamano: archivo.size,
      });
      await subirConProgreso(ruta, token, archivo, tipoMime, setProgreso);
      await enviarJson("/api/portal/materiales/archivo", { patrocinador_id: e.id, ruta, tipo, comentario });
      setOk(`${TEXTO_TIPO[tipo].recibido}. Lo revisaremos y te avisaremos si hace falta algo.`);
      setArchivo(null);
      setComentario("");
      if (inputRef.current) inputRef.current.value = "";
      onSubido();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido subir el archivo. Inténtalo de nuevo.");
    }
    setProgreso(null);
  }

  const subiendo = progreso !== null;

  return (
    <Bloque titulo="Enviarnos un archivo" ayuda="Sigue estos pasos. Puedes enviar varios archivos, uno detrás de otro.">
      <form onSubmit={subir} className="flex flex-col gap-5">
        <Paso n={1} titulo="Elige qué nos envías">
          <select
            aria-label="Qué nos envías"
            className="campo-input text-base sm:max-w-xs"
            value={tipo}
            disabled={subiendo}
            onChange={(ev) => setTipo(ev.target.value as TipoArchivoPortal)}
          >
            {TIPOS_ARCHIVO_PORTAL.map((t) => (
              <option key={t} value={t}>
                {TEXTO_TIPO[t].opcion}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">{TEXTO_TIPO[tipo].ayuda}</p>
        </Paso>
        <Paso n={2} titulo="Elige el archivo">
          <input
            ref={inputRef}
            type="file"
            accept={ACEPTADOS}
            disabled={subiendo}
            aria-label="Archivo"
            onChange={(ev) => elegirArchivo(ev.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-[var(--borde)] file:bg-white file:px-4 file:py-2 file:font-medium file:text-[var(--balvert-azul-oscuro)]"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Formatos: {FORMATOS_PERMITIDOS}. Máximo 50 MB por archivo (si pesa más, envíalo por WeTransfer a
            secretaria@balvert.es).
          </p>
        </Paso>
        <Paso n={3} titulo="Añade un comentario (si quieres)">
          <textarea
            aria-label="Comentario"
            className="campo-input text-base"
            rows={2}
            maxLength={MAX_COMENTARIO_ARCHIVO}
            disabled={subiendo}
            placeholder="Por ejemplo: colores, qué versión del logo usar o cualquier indicación"
            value={comentario}
            onChange={(ev) => setComentario(ev.target.value)}
          />
        </Paso>
        <Paso n={4} titulo="Envíalo">
          {subiendo && (
            <div className="mb-3">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full rounded-full bg-[var(--balvert-azul-oscuro)] transition-all"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-600">Subiendo… {progreso}%. No cierres esta página hasta que termine.</p>
            </div>
          )}
          {error && (
            <div className="mb-3">
              <Aviso tipo="error">{error}</Aviso>
            </div>
          )}
          {ok && (
            <div className="mb-3">
              <Aviso tipo="ok">{ok}</Aviso>
            </div>
          )}
          <button type="submit" disabled={!archivo || subiendo || Boolean(error)} className={botonPrincipal}>
            {subiendo ? "Enviando…" : "Enviar archivo"}
          </button>
          {!archivo && !subiendo && <p className="mt-2 text-xs text-zinc-500">Primero elige el archivo (paso 2).</p>}
        </Paso>
      </form>
    </Bloque>
  );
}

function Subidos({ e, onBorrado }: { e: EmpresaMaterial; onBorrado: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  async function borrar(a: ArchivoSubido) {
    if (!window.confirm(`¿Seguro que quieres borrar «${a.nombre}»? Se borrará también para nosotros y no se puede deshacer.`)) {
      return;
    }
    setError(null);
    setBorrando(a.id);
    try {
      const res = await fetch(`/api/portal/materiales/archivo?id=${encodeURIComponent(a.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se ha podido borrar. Inténtalo de nuevo.");
      onBorrado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido borrar. Inténtalo de nuevo.");
    }
    setBorrando(null);
  }

  return (
    <Bloque titulo="Lo que nos has enviado" ayuda="Puedes descargar tus archivos o borrarlos si te has equivocado (y volver a enviarlos).">
      {error && (
        <div className="mb-2">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}
      {e.subidos.length === 0 ? (
        <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-600">Todavía no nos has enviado nada. Empieza por el logo.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--borde)]">
          {e.subidos.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="break-words font-medium text-zinc-800">
                  <span className="mr-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {NOMBRE_TIPO_ARCHIVO[a.tipo]}
                  </span>
                  {a.nombre}
                </p>
                <p className="break-words text-xs text-zinc-500">
                  Enviado el {fecha(a.creado)}
                  {a.email ? ` por ${a.email}` : ""}
                </p>
                {a.comentario && <p className="mt-1 whitespace-pre-line text-xs text-zinc-600">«{a.comentario}»</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <a href={`/api/portal/materiales/descargar?id=${encodeURIComponent(a.id)}`} className={botonSecundario}>
                  Descargar
                </a>
                <button
                  type="button"
                  onClick={() => borrar(a)}
                  disabled={borrando === a.id}
                  className="min-h-11 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {borrando === a.id ? "Borrando…" : "Borrar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  );
}

function DatosPonente({ e, ponente, onGuardado }: { e: EmpresaMaterial; ponente: Ponente; onGuardado: () => void }) {
  const [valores, setValores] = useState({
    ponente_nombre: ponente.ponente_nombre ?? "",
    ponente_cargo: ponente.ponente_cargo ?? "",
    ponencia_titulo: ponente.ponencia_titulo ?? "",
    ponencia_duracion_min: ponente.ponencia_duracion_min != null ? String(ponente.ponencia_duracion_min) : "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setOk(false);
    const duracion = valores.ponencia_duracion_min.trim();
    if (duracion !== "" && !/^\d+$/.test(duracion)) {
      setError("En «Duración» escribe solo el número de minutos, sin decimales (por ejemplo, 15).");
      return;
    }
    setGuardando(true);
    try {
      await enviarJson("/api/portal/materiales/ponente", {
        patrocinador_id: e.id,
        ponente_nombre: valores.ponente_nombre,
        ponente_cargo: valores.ponente_cargo,
        ponencia_titulo: valores.ponencia_titulo,
        ponencia_duracion_min: duracion === "" ? null : Number(duracion),
      });
      setOk(true);
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar. Inténtalo de nuevo en un momento.");
    }
    setGuardando(false);
  }

  const campo = (clave: keyof typeof valores, etiqueta: string, ayuda: string, max: number, tipo = "text") => (
    <div>
      <label className="campo-label" htmlFor={`${clave}-${e.id}`}>
        {etiqueta}
      </label>
      <input
        id={`${clave}-${e.id}`}
        type={tipo}
        className="campo-input text-base"
        maxLength={tipo === "text" ? max : undefined}
        min={tipo === "number" ? 1 : undefined}
        max={tipo === "number" ? max : undefined}
        inputMode={tipo === "number" ? "numeric" : undefined}
        value={valores[clave]}
        onChange={(ev) => setValores((v) => ({ ...v, [clave]: ev.target.value }))}
      />
      <p className="mt-1 text-xs text-zinc-500">{ayuda}</p>
    </div>
  );

  return (
    <Bloque
      titulo="Datos del ponente"
      ayuda="Cuéntanos quién dará la ponencia y de qué tratará. Lo usaremos para el programa. Puedes cambiarlo más adelante."
    >
      <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
        {campo("ponente_nombre", "Nombre y apellidos del ponente", "Tal y como quieres que aparezca en el programa.", 200)}
        {campo("ponente_cargo", "Cargo", "Por ejemplo: Director técnico.", 200)}
        <div className="sm:col-span-2">
          {campo("ponencia_titulo", "Título de la ponencia", "Si aún no es definitivo, pon uno provisional.", 300)}
        </div>
        {campo("ponencia_duracion_min", "Duración (minutos)", "Solo el número, por ejemplo 15.", 600, "number")}
        <div className="flex flex-col gap-3 sm:col-span-2">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {ok && <Aviso tipo="ok">Datos del ponente guardados. Gracias.</Aviso>}
          <div>
            <button type="submit" disabled={guardando} className={botonPrincipal}>
              {guardando ? "Guardando…" : "Guardar datos del ponente"}
            </button>
          </div>
        </div>
      </form>
    </Bloque>
  );
}

// ---- Pestaña "Documentos": lo que el equipo comparte con cada empresa ----

export function DocumentosOrganizacion({ empresas }: { empresas: EmpresaMaterial[] }) {
  const conDocumentos = empresas.filter((e) => e.organizacion.length > 0);
  if (conDocumentos.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {conDocumentos.map((e) => (
        <Bloque key={e.id} titulo={`Documentos para ${e.empresa ?? "tu empresa"}`}>
          <ul className="flex flex-col divide-y divide-[var(--borde)]">
            {e.organizacion.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="break-words font-medium text-zinc-800">{a.titulo || a.nombre}</p>
                  <p className="text-xs text-zinc-500">
                    {NOMBRE_TIPO_ARCHIVO[a.tipo]} · {fecha(a.creado)}
                  </p>
                </div>
                <a
                  href={`/api/portal/materiales/descargar?id=${encodeURIComponent(a.id)}`}
                  className={`${botonSecundario} shrink-0 self-start sm:self-auto`}
                >
                  Descargar
                </a>
              </li>
            ))}
          </ul>
        </Bloque>
      ))}
    </div>
  );
}
