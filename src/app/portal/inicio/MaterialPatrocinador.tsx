"use client";

import { useRef, useState } from "react";
import { EtiquetaEstado, Tarjeta } from "@/components/PortalZona";
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

// Pestañas "Mi patrocinio", "Rollups y vinilado", "Ponencia" y "Material" de la zona de empresa
// (/portal/empresa), y los documentos que el equipo comparte con la empresa.
// Todo pasa por /api/portal/materiales/*, que decide la empresa con la sesión
// de empresa (el patrocinador_id que se manda se ignora).

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
  ponente_email: string | null;
  ponente_telefono: string | null;
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
    // Medidas de SU mostrador (Oro o Diamante), de Ediciones. null si no hay.
    medidas: string | null;
    rollupsSolicitados: number;
    rollupPorNuestraCuenta: boolean;
    vinilado: boolean;
  };
  ponencia: {
    decideEmpresa: boolean;
    respuesta: "Sí" | "No" | null;
    maxMinutos: number | null;
    explicacion: string | null;
    duracionFija: string | null;
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
  if (res.status === 401) throw new Error("Tu sesión ha caducado. Recarga la página y vuelve a entrar con el usuario y la contraseña de tu empresa.");
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

// Tarjeta blanca de la zona (mismo estilo que PortalZona).
function Bloque({ titulo, ayuda, children }: { titulo: string; ayuda?: React.ReactNode; children: React.ReactNode }) {
  return <Tarjeta titulo={titulo} ayuda={ayuda}>{children}</Tarjeta>;
}

const Etiqueta = EtiquetaEstado;

const botonPrincipal =
  "min-h-11 rounded-md bg-[var(--balvert-azul-oscuro)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";
const botonSecundario =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--borde)] px-4 py-2 text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50";

// ---- Pestaña "Mi patrocinio" ----

export function SeccionPatrocinio({ e }: { e: EmpresaMaterial }) {
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
    </div>
  );
}

// ---- Pestaña "Rollups y vinilado" ----

// Quién ofrece la pestaña: si la edición tiene precio de rollup, o de
// vinilado y la empresa tiene mostrador.
export function tieneProduccion(e: EmpresaMaterial) {
  return Boolean(e.produccion.precioRollup || e.produccion.precioVinilado);
}

// Rollups incluidos en la colocación según la categoría (dossier).
const ROLLUPS_INCLUIDOS: Record<string, { nombre: string; rollups: number }> = {
  "💎 DIAMANTE": { nombre: "Diamante", rollups: 2 },
  "⭐ ORO": { nombre: "Oro", rollups: 1 },
};

// «92 cm de ancho × 93 cm de alto × 46 cm de fondo, 6 m² disponibles» →
// recuadros (medida + qué es) y el texto que no sea una medida («espacio doble»).
function trozosMedidas(texto: string) {
  const recuadros: { valor: string; que: string }[] = [];
  const otros: string[] = [];
  for (const parte of texto.split(/\s*[×·;]\s*|,\s+|\s+x\s+/)) {
    const limpio = parte.replace(/^mostrador\s+de\s+/i, "").trim();
    if (!limpio) continue;
    const m = limpio.match(/^(\d+(?:[.,]\d+)?\s*(?:cm|mm|m²|m2|m))(?:\s+(?:de\s+)?(.*))?$/i);
    if (m) recuadros.push({ valor: m[1].replace(/m2$/i, "m²"), que: (m[2] ?? "").trim() });
    else otros.push(limpio.charAt(0).toUpperCase() + limpio.slice(1));
  }
  return { recuadros, otros };
}

export function SeccionProduccion({ e, onGuardado }: { e: EmpresaMaterial; onGuardado: () => void }) {
  const p = e.produccion;
  const [rollups, setRollups] = useState(p.rollupsSolicitados);
  const [vinilado, setVinilado] = useState(p.vinilado);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!tieneProduccion(e)) return null;

  const cambiaRollups = Boolean(p.precioRollup) && rollups !== p.rollupsSolicitados;
  const cambiaVinilado = Boolean(p.precioVinilado) && vinilado !== p.vinilado;
  const hayCambios = cambiaRollups || cambiaVinilado;
  const incluidos = e.categoria ? ROLLUPS_INCLUIDOS[e.categoria] : undefined;
  const medidas = p.medidas ? trozosMedidas(p.medidas) : null;

  // Lo pedido en pantalla (guardado o no) y su total.
  const pedido: string[] = [];
  let total = 0;
  if (p.precioRollup && rollups > 0) {
    pedido.push(`${rollups} rollup${rollups === 1 ? "" : "s"}`);
    total += rollups * p.precioRollup;
  }
  if (p.precioVinilado && vinilado) {
    pedido.push("Vinilado del mostrador");
    total += p.precioVinilado;
  }

  function cambiarRollups(d: number) {
    setOk(null);
    setRollups((n) => Math.max(0, Math.min(MAX_ROLLUPS, n + d)));
  }

  async function guardar() {
    setError(null);
    setOk(null);
    // Confirmación con lo que se pide y su importe.
    const pedir: string[] = [];
    const anular: string[] = [];
    if (cambiaRollups && p.precioRollup) {
      if (rollups > 0) {
        pedir.push(`${rollups} rollup${rollups === 1 ? "" : "s"} por ${euros(rollups * p.precioRollup)} + IVA`);
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
        ...(p.precioRollup ? { rollups } : {}),
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
    <>
      <div className={`grid gap-4 ${p.precioRollup && p.precioVinilado ? "min-[900px]:grid-cols-2" : ""}`}>
        {p.precioRollup && (
          <Tarjeta titulo="Rollups" className="flex flex-col">
            <div className="flex flex-col gap-3">
              <p className="text-[22px] font-extrabold text-[#163f57]">
                {euros(p.precioRollup)}{" "}
                <small className="text-[13px] font-semibold text-[#5d6b76]">+ IVA cada uno · 150 × 200 cm</small>
              </p>
              <p className="rounded-lg border-l-4 border-[var(--balvert-azul)] bg-[#f1f7fb] px-3 py-2.5 text-[13px] leading-relaxed text-[#29404f]">
                {incluidos ? (
                  <>
                    Vuestro patrocinio {incluidos.nombre} ya incluye la{" "}
                    <strong>
                      colocación de {incluidos.rollups} rollup{incluidos.rollups === 1 ? "" : "s"}
                    </strong>{" "}
                    en el congreso. Aquí podéis pedirnos que os fabriquemos los que queráis.
                  </>
                ) : (
                  "Podéis pedirnos que os fabriquemos los que queráis."
                )}
              </p>
              <p id={`rollups-${e.id}`} className="text-sm font-bold">
                ¿Cuántos queréis que os fabriquemos?
              </p>
              <div
                role="group"
                aria-labelledby={`rollups-${e.id}`}
                className="flex w-max items-center overflow-hidden rounded-xl border border-[#e3e8ec]"
              >
                <button
                  type="button"
                  aria-label="Uno menos"
                  onClick={() => cambiarRollups(-1)}
                  disabled={rollups <= 0}
                  className="h-12 w-12 bg-[#f3f6f8] text-2xl text-[var(--balvert-azul-oscuro)] disabled:opacity-40"
                >
                  −
                </button>
                <output aria-live="polite" className="w-16 text-center text-xl font-extrabold">
                  {rollups}
                </output>
                <button
                  type="button"
                  aria-label="Uno más"
                  onClick={() => cambiarRollups(1)}
                  disabled={rollups >= MAX_ROLLUPS}
                  className="h-12 w-12 bg-[#f3f6f8] text-2xl text-[var(--balvert-azul-oscuro)] disabled:opacity-40"
                >
                  +
                </button>
              </div>
              <p className="text-sm text-[#5d6b76]">
                Subtotal: <strong className="text-[#1f2a33]">{euros(rollups * p.precioRollup)}</strong> + IVA
              </p>
            </div>
          </Tarjeta>
        )}
        {p.precioVinilado && (
          <Tarjeta titulo="Vinilado del mostrador" className="flex flex-col">
            <div className="flex flex-col gap-3">
              <p className="text-[22px] font-extrabold text-[#163f57]">
                {euros(p.precioVinilado)}{" "}
                <small className="text-[13px] font-semibold text-[#5d6b76]">+ IVA · precio cerrado</small>
              </p>
              {medidas && (medidas.recuadros.length > 0 || medidas.otros.length > 0) && (
                <div className="flex flex-col gap-2">
                  <p className="text-[13px] text-[#5d6b76]">
                    Vuestro mostrador{incluidos ? ` (${incluidos.nombre})` : ""}
                    {medidas.otros.length > 0 ? `: ${medidas.otros.join(" · ")}` : ":"}
                  </p>
                  {medidas.recuadros.length > 0 && (
                    <div
                      className={`grid gap-2 ${
                        medidas.recuadros.length <= 3 ? "grid-cols-3" : "grid-cols-2 min-[480px]:grid-cols-4"
                      }`}
                    >
                      {medidas.recuadros.map((r, i) => (
                        <div key={i} className="rounded-[10px] bg-[#f6f8fa] p-2 text-center text-xs text-[#5d6b76]">
                          <b className="block text-base text-[#1f2a33]">{r.valor}</b>
                          {r.que}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={vinilado}
                onClick={() => {
                  setOk(null);
                  setVinilado((v) => !v);
                }}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left ${
                  vinilado ? "border-[var(--balvert-azul)] bg-[#f1f9fe]" : "border-[#e3e8ec] bg-white"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`relative h-[26px] w-[46px] flex-none rounded-full transition-colors ${
                    vinilado ? "bg-[var(--balvert-azul-oscuro)]" : "bg-[#cfd8de]"
                  }`}
                >
                  <span
                    className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all ${
                      vinilado ? "left-[23px]" : "left-[3px]"
                    }`}
                  />
                </span>
                <span className="text-sm">
                  <b>Sí, queremos el vinilado</b>
                  <br />
                  <small className="text-[#5d6b76]">Os pediremos el diseño en «Material».</small>
                </span>
              </button>
            </div>
          </Tarjeta>
        )}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {/* Barra del total: fija abajo en móvil. */}
      <div className="sticky bottom-2.5 z-10 flex flex-wrap items-center justify-between gap-3.5 rounded-[14px] bg-[#163f57] px-5 py-4 text-white shadow-lg min-[760px]:static min-[760px]:shadow-none">
        <div>
          <p className="text-sm opacity-90">{pedido.length ? pedido.join(" + ") : "No habéis pedido nada"}</p>
          <p className="text-2xl font-extrabold">
            {euros(total)} <small className="text-sm font-semibold">+ IVA</small>
          </p>
        </div>
        <div className="text-right">
          <button
            type="button"
            onClick={guardar}
            disabled={!hayCambios || guardando}
            className="min-h-11 rounded-[10px] bg-[var(--balvert-marron-claro)] px-4 text-sm font-bold text-[#2b1f00] disabled:cursor-not-allowed disabled:bg-[#d5dde3] disabled:text-[#3a4a55]"
          >
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
          <p className={`mt-1 text-[13px] ${hayCambios ? "text-[#ffe3a3]" : "text-[#bfe6c9]"}`}>
            {hayCambios ? "Tienes cambios sin guardar" : "✓ Pedido guardado"}
          </p>
        </div>
      </div>
    </>
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
    ayuda: "El diseño para tu rollup de 150 × 200 cm. Si quieres que te lo fabriquemos, pídelo en la pestaña «Rollups y vinilado».",
    recibido: "Diseño del rollup recibido",
  },
  vinilado: {
    opcion: "Diseño del vinilado",
    ayuda: "El diseño para vinilar el mostrador (las medidas están en la pestaña «Rollups y vinilado», donde también puedes pedirlo).",
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
  return Boolean(
    // La duración no cuenta: es fija (Diamante/Oro) o la pone la organización.
    p && p.ponente_nombre && p.ponente_cargo && p.ponente_email && p.ponente_telefono && p.ponencia_titulo
  );
}

// La ponencia tiene su propia pestaña (SeccionPonencia): Material se queda
// con el logo y los diseños de rollup y vinilado.
const TIPOS_MATERIAL: readonly TipoArchivoPortal[] = ["logo", "rollup", "vinilado"];
const TIPOS_PONENCIA: readonly TipoArchivoPortal[] = ["ponencia"];

// Quién ve la pestaña «Ponencia»: Diamante y Oro (la deciden ellos) y quien
// tenga la ponencia activada en la ficha (p. ej. una Plata).
export function tienePestanaPonencia(e: EmpresaMaterial) {
  return e.ponencia.decideEmpresa || e.estado.tienePonencia;
}

// ---- Pestaña "Ponencia" ----

export function SeccionPonencia({ e, recargar }: { e: EmpresaMaterial; recargar: () => void }) {
  const conPonencia = e.estado.tienePonencia;
  return (
    <div className="flex flex-col gap-4">
      {e.estado.fechaLimite && conPonencia && <FechaLimite iso={e.estado.fechaLimite} />}
      {(conPonencia || (e.ponencia.decideEmpresa && !e.ponencia.respuesta)) && (
        <Bloque titulo="Tu ponencia de un vistazo">
          <ul className="flex flex-col gap-2 text-sm text-zinc-700">
            {e.ponencia.decideEmpresa && !e.ponencia.respuesta && (
              <li className="flex items-center justify-between gap-3">
                ¿Vais a hacer ponencia? <Etiqueta bien={false}>Falta responder</Etiqueta>
              </li>
            )}
            {conPonencia && (
              <>
                <li className="flex items-center justify-between gap-3">
                  Presentación{" "}
                  <Etiqueta bien={e.estado.ponenciaRecibida}>{e.estado.ponenciaRecibida ? "Recibida" : "Pendiente"}</Etiqueta>
                </li>
                <li className="flex items-center justify-between gap-3">
                  Datos del ponente{" "}
                  <Etiqueta bien={ponenteCompleto(e.ponente)}>{ponenteCompleto(e.ponente) ? "Completos" : "Faltan datos"}</Etiqueta>
                </li>
              </>
            )}
          </ul>
        </Bloque>
      )}
      {e.ponencia.decideEmpresa ? (
        <PonenciaEmpresa key={e.id} e={e} onGuardado={recargar} />
      ) : (
        e.ponente && <DatosPonente e={e} ponente={e.ponente} onGuardado={recargar} />
      )}
      {conPonencia && (
        <>
          <Subir e={e} onSubido={recargar} tipos={TIPOS_PONENCIA} />
          <Subidos e={e} onBorrado={recargar} tipos={TIPOS_PONENCIA} />
        </>
      )}
    </div>
  );
}

export function SeccionMaterial({
  e,
  recargar,
  irAProduccion,
}: {
  e: EmpresaMaterial;
  recargar: () => void;
  irAProduccion: () => void;
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
            <button type="button" onClick={irAProduccion} className="font-medium text-[var(--balvert-azul-oscuro)] underline">
              Rollups y vinilado
            </button>
            .
          </p>
        )}
      </Bloque>

      <Subir e={e} onSubido={recargar} tipos={TIPOS_MATERIAL} />
      <Subidos e={e} onBorrado={recargar} tipos={TIPOS_MATERIAL} />
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

function Subir({
  e,
  onSubido,
  tipos = TIPOS_ARCHIVO_PORTAL,
}: {
  e: EmpresaMaterial;
  onSubido: () => void;
  tipos?: readonly TipoArchivoPortal[];
}) {
  const [tipo, setTipo] = useState<TipoArchivoPortal>(tipos[0]);
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
    <Bloque
      titulo={tipos.length === 1 && tipos[0] === "ponencia" ? "Enviarnos la presentación" : "Enviarnos un archivo"}
      ayuda="Sigue estos pasos. Puedes enviar varios archivos, uno detrás de otro."
    >
      <form onSubmit={subir} className="flex flex-col gap-5">
        <Paso n={1} titulo="Elige qué nos envías">
          <select
            aria-label="Qué nos envías"
            className="campo-input text-base sm:max-w-xs"
            value={tipo}
            disabled={subiendo}
            onChange={(ev) => setTipo(ev.target.value as TipoArchivoPortal)}
          >
            {tipos.map((t) => (
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

function Subidos({
  e,
  onBorrado,
  tipos,
}: {
  e: EmpresaMaterial;
  onBorrado: () => void;
  tipos: readonly TipoArchivoPortal[];
}) {
  const subidos = e.subidos.filter((a) => (tipos as readonly string[]).includes(a.tipo));
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
      {subidos.length === 0 ? (
        <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-600">
          {tipos.includes("ponencia") ? "Todavía no nos has enviado la presentación." : "Todavía no nos has enviado nada. Empieza por el logo."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--borde)]">
          {subidos.map((a) => (
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

// Diamante y Oro: «¿Vais a hacer ponencia?» y, si es que sí, los datos.
function PonenciaEmpresa({ e, onGuardado }: { e: EmpresaMaterial; onGuardado: () => void }) {
  const [respuesta, setRespuesta] = useState<"Sí" | "No" | null>(e.ponencia.respuesta);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function responderNo() {
    if (!window.confirm("¿Confirmas que no vais a hacer ponencia? Podréis cambiarlo más adelante.")) return;
    setError(null);
    setGuardando(true);
    try {
      await enviarJson("/api/portal/materiales/ponente", { tiene_ponencia: "No" });
      setRespuesta("No");
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar.");
    }
    setGuardando(false);
  }

  const opcion = (valor: "Sí" | "No", texto: string) => (
    <button
      type="button"
      disabled={guardando}
      onClick={() => (valor === "No" ? (e.ponencia.respuesta === "No" ? setRespuesta("No") : responderNo()) : setRespuesta("Sí"))}
      aria-pressed={respuesta === valor}
      className={`min-h-11 rounded-md border px-5 py-2 text-sm font-semibold ${
        respuesta === valor
          ? "border-[var(--balvert-azul-oscuro)] bg-sky-50 text-[var(--balvert-azul-oscuro)]"
          : "border-[var(--borde)] text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {texto}
    </button>
  );

  return (
    <Bloque titulo="Ponencia" ayuda={e.ponencia.explicacion ?? undefined}>
      <p className="mb-2 text-sm font-semibold text-zinc-800">¿Vais a hacer ponencia?</p>
      <div className="mb-3 flex gap-2">
        {opcion("Sí", "Sí")}
        {opcion("No", "No")}
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {respuesta === "No" && e.ponencia.respuesta === "No" && (
        <p className="text-sm text-zinc-600">Nos habéis dicho que no haréis ponencia. Si cambiáis de idea, pulsad «Sí».</p>
      )}
      {respuesta === "Sí" && e.ponente && (
        <div className="mt-2">
          <DatosPonente e={e} ponente={e.ponente} onGuardado={onGuardado} conRespuesta sinMarco />
        </div>
      )}
    </Bloque>
  );
}

function DatosPonente({
  e,
  ponente,
  onGuardado,
  conRespuesta = false,
  sinMarco = false,
}: {
  e: EmpresaMaterial;
  ponente: Ponente;
  onGuardado: () => void;
  // Diamante/Oro: al guardar también se responde «Sí» a la ponencia.
  conRespuesta?: boolean;
  sinMarco?: boolean;
}) {
  // La duración no se escribe: la de su categoría o la que ponga la organización.
  const duracion = e.ponencia.duracionFija
    ? `Duración de vuestra ponencia: ${e.ponencia.duracionFija}.`
    : ponente.ponencia_duracion_min
      ? `Duración de vuestra ponencia: ${ponente.ponencia_duracion_min} minutos.`
      : "La duración os la confirmará la organización.";
  const [valores, setValores] = useState({
    ponente_nombre: ponente.ponente_nombre ?? "",
    ponente_cargo: ponente.ponente_cargo ?? "",
    ponente_email: ponente.ponente_email ?? "",
    ponente_telefono: ponente.ponente_telefono ?? "",
    ponencia_titulo: ponente.ponencia_titulo ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setOk(false);
    setGuardando(true);
    try {
      await enviarJson("/api/portal/materiales/ponente", {
        patrocinador_id: e.id,
        ponente_nombre: valores.ponente_nombre,
        ponente_cargo: valores.ponente_cargo,
        ponente_email: valores.ponente_email,
        ponente_telefono: valores.ponente_telefono,
        ponencia_titulo: valores.ponencia_titulo,
        ...(conRespuesta ? { tiene_ponencia: "Sí" } : {}),
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
        maxLength={max}
        value={valores[clave]}
        onChange={(ev) => setValores((v) => ({ ...v, [clave]: ev.target.value }))}
      />
      <p className="mt-1 text-xs text-zinc-500">{ayuda}</p>
    </div>
  );

  const formulario = (
      <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
        {campo("ponente_nombre", "Nombre y apellidos del ponente", "Tal y como quieres que aparezca en el programa.", 200)}
        {campo("ponente_cargo", "Cargo", "Por ejemplo: Director técnico.", 200)}
        {campo("ponente_email", "Email del ponente", "Para escribirle sobre la ponencia.", 200, "email")}
        {campo("ponente_telefono", "Teléfono del ponente", "Por si tenemos que localizarle el día del congreso.", 40, "tel")}
        <div className="sm:col-span-2">
          {campo("ponencia_titulo", "Título de la ponencia", "Si aún no es definitivo, pon uno provisional.", 300)}
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <p className="text-sm font-semibold text-zinc-800">{duracion}</p>
          <p className="text-xs text-zinc-500">La presentación se sube más abajo, en «Enviarnos la presentación».</p>
        </div>
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
  );
  if (sinMarco) return formulario;
  return (
    <Bloque
      titulo="Datos del ponente"
      ayuda="Cuéntanos quién dará la ponencia y de qué tratará. Lo usaremos para el programa. Puedes cambiarlo más adelante."
    >
      {formulario}
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
