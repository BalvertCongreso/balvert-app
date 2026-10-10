"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
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

// "Material para el congreso" en /portal/inicio, para los contactos de una
// empresa patrocinadora. Todo pasa por /api/portal/materiales/*, que
// comprueba con la sesión que la empresa es suya.

interface ArchivoSubido {
  id: string;
  tipo: TipoArchivo;
  nombre: string;
  creado: string;
  email: string | null;
  comentario: string | null;
}

interface ArchivoOrganizacion {
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

interface EmpresaMaterial {
  id: string;
  empresa: string | null;
  categoria: string | null;
  incluye: string | null;
  particularesIncluidos: string | null;
  particularesExcluidos: string | null;
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

const MAX_ROLLUPS = 99;
const ACEPTADOS = Object.keys(TIPO_POR_EXTENSION).map((e) => `.${e}`).join(",");

const euros = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

async function enviarJson(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo completar. Inténtalo de nuevo.");
  return data;
}

function Aviso({ tipo, children }: { tipo: "error" | "ok"; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-md border p-3 text-sm ${
        tipo === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-800"
      }`}
    >
      {children}
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--borde)] pt-4">
      <h4 className="mb-2 text-sm font-semibold text-[var(--balvert-marron)]">{titulo}</h4>
      {children}
    </div>
  );
}

const botonPrincipal =
  "rounded-md bg-[var(--balvert-azul-oscuro)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60";
const botonSecundario =
  "rounded-md border border-[var(--borde)] px-3 py-1.5 text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50";

function Produccion({ e, onGuardado }: { e: EmpresaMaterial; onGuardado: () => void }) {
  const p = e.produccion;
  const [rollups, setRollups] = useState(String(p.rollupsSolicitados));
  const [vinilado, setVinilado] = useState(p.vinilado);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  if (!p.precioRollup && !p.precioVinilado) return null;

  const numRollups = Number(rollups);
  const rollupsValido = rollups !== "" && Number.isInteger(numRollups) && numRollups >= 0 && numRollups <= MAX_ROLLUPS;
  const hayCambios =
    (p.precioRollup && rollupsValido && numRollups !== p.rollupsSolicitados) ||
    (p.precioVinilado && vinilado !== p.vinilado);

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setOk(false);
    if (p.precioRollup && !rollupsValido) {
      setError(`El número de rollups tiene que ser un número entero entre 0 y ${MAX_ROLLUPS}.`);
      return;
    }
    setGuardando(true);
    try {
      await enviarJson("/api/portal/materiales/produccion", {
        patrocinador_id: e.id,
        ...(p.precioRollup ? { rollups: numRollups } : {}),
        ...(p.precioVinilado ? { vinilado } : {}),
      });
      setOk(true);
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
    setGuardando(false);
  }

  const estado: string[] = [];
  if (p.precioRollup) {
    estado.push(
      p.rollupsSolicitados > 0
        ? `${p.rollupsSolicitados} rollup${p.rollupsSolicitados === 1 ? "" : "s"}`
        : "ningún rollup"
    );
  }
  if (p.precioVinilado) estado.push(p.vinilado ? "vinilado del mostrador" : "sin vinilado del mostrador");

  return (
    <Bloque titulo="Producción de rollup y vinilado">
      <p className="mb-3 text-sm text-zinc-600">
        Si quieres, te fabricamos el rollup y/o el vinilado del mostrador. No se paga aquí: te enviaremos la factura.
      </p>
      {p.texto && <p className="mb-4 whitespace-pre-line text-sm text-zinc-600">{p.texto}</p>}
      <form onSubmit={guardar} className="flex flex-col gap-4">
        {p.precioRollup && (
          <div>
            <label className="campo-label" htmlFor={`rollups-${e.id}`}>
              Rollups de 150 × 200 cm ({euros(p.precioRollup)} + IVA cada uno)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                id={`rollups-${e.id}`}
                type="number"
                min={0}
                max={MAX_ROLLUPS}
                step={1}
                inputMode="numeric"
                className="campo-input w-24"
                value={rollups}
                onChange={(ev) => setRollups(ev.target.value)}
              />
              <span className="text-sm text-zinc-700">
                {rollupsValido ? (
                  <>
                    Total: <strong>{euros(numRollups * p.precioRollup)} + IVA</strong>
                  </>
                ) : (
                  `Entre 0 y ${MAX_ROLLUPS}`
                )}
              </span>
            </div>
          </div>
        )}
        {p.precioVinilado && (
          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={vinilado}
              onChange={(ev) => setVinilado(ev.target.checked)}
            />
            <span>
              Quiero el vinilado del mostrador: <strong>{euros(p.precioVinilado)} + IVA</strong> (precio cerrado por el
              mostrador completo)
            </span>
          </label>
        )}
        <p className="text-xs text-zinc-500">Ahora mismo tienes pedido: {estado.join(" y ")}.</p>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">Pedido guardado. Te avisaremos si necesitamos algo más.</Aviso>}
        <div>
          <button type="submit" disabled={guardando || !hayCambios} className={botonPrincipal}>
            {guardando ? "Guardando…" : "Guardar pedido"}
          </button>
        </div>
      </form>
    </Bloque>
  );
}

function Subir({ e, onSubido }: { e: EmpresaMaterial; onSubido: () => void }) {
  const [tipo, setTipo] = useState<TipoArchivoPortal>("logo");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [comentario, setComentario] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function subir(ev: React.FormEvent) {
    ev.preventDefault();
    if (!archivo) return;
    setError(null);
    setOk(null);
    if (!TIPO_POR_EXTENSION[extensionDe(archivo.name)]) {
      setError(`Solo se pueden subir ${FORMATOS_PERMITIDOS}.`);
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_ARCHIVO) {
      setError(MENSAJE_DEMASIADO_GRANDE);
      return;
    }
    setSubiendo(true);
    try {
      const { ruta, token, tipo: tipoMime } = await enviarJson("/api/portal/materiales/subida", {
        patrocinador_id: e.id,
        tipo,
        nombre: archivo.name,
        tamano: archivo.size,
      });
      const { error: errorSubida } = await supabase.storage
        .from(BUCKET_ARCHIVOS_PATROCINADOR)
        .uploadToSignedUrl(ruta, token, archivo, { contentType: tipoMime });
      if (errorSubida) {
        throw new Error(
          /size|large|exceed/i.test(errorSubida.message) ? MENSAJE_DEMASIADO_GRANDE : "No se pudo subir el archivo. Inténtalo de nuevo."
        );
      }
      await enviarJson("/api/portal/materiales/archivo", { patrocinador_id: e.id, ruta, tipo, comentario });
      setOk(`Recibido: ${archivo.name}. Gracias, lo revisaremos.`);
      setArchivo(null);
      setComentario("");
      if (inputRef.current) inputRef.current.value = "";
      onSubido();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
    setSubiendo(false);
  }

  return (
    <Bloque titulo="Enviarnos material">
      <form onSubmit={subir} className="flex flex-col gap-3">
        <div>
          <label className="campo-label" htmlFor={`tipo-${e.id}`}>
            ¿Qué nos envías?
          </label>
          <select
            id={`tipo-${e.id}`}
            className="campo-input max-w-xs"
            value={tipo}
            onChange={(ev) => setTipo(ev.target.value as TipoArchivoPortal)}
          >
            {TIPOS_ARCHIVO_PORTAL.map((t) => (
              <option key={t} value={t}>
                {t === "rollup" ? "Diseño del rollup" : t === "vinilado" ? "Diseño del vinilado" : NOMBRE_TIPO_ARCHIVO[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="campo-label" htmlFor={`archivo-${e.id}`}>
            Archivo
          </label>
          <input
            id={`archivo-${e.id}`}
            ref={inputRef}
            type="file"
            accept={ACEPTADOS}
            onChange={(ev) => setArchivo(ev.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          <p className="mt-1 text-xs text-zinc-500">{FORMATOS_PERMITIDOS}. Máximo 50 MB.</p>
        </div>
        <div>
          <label className="campo-label" htmlFor={`comentario-${e.id}`}>
            Comentario (opcional)
          </label>
          <textarea
            id={`comentario-${e.id}`}
            className="campo-input"
            rows={2}
            maxLength={MAX_COMENTARIO_ARCHIVO}
            placeholder="p. ej. medidas, colores o indicaciones para el rollup"
            value={comentario}
            onChange={(ev) => setComentario(ev.target.value)}
          />
        </div>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        <div>
          <button type="submit" disabled={!archivo || subiendo} className={botonPrincipal}>
            {subiendo ? "Subiendo…" : "Enviar archivo"}
          </button>
        </div>
      </form>
    </Bloque>
  );
}

function Subidos({ e, onBorrado }: { e: EmpresaMaterial; onBorrado: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  async function borrar(a: ArchivoSubido) {
    if (!window.confirm(`¿Borrar "${a.nombre}"? No se puede deshacer.`)) return;
    setError(null);
    setBorrando(a.id);
    try {
      const res = await fetch(`/api/portal/materiales/archivo?id=${encodeURIComponent(a.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo borrar.");
      onBorrado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
    setBorrando(null);
  }

  return (
    <Bloque titulo="Lo que nos has enviado">
      {error && <div className="mb-2"><Aviso tipo="error">{error}</Aviso></div>}
      {e.subidos.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no nos has enviado nada desde aquí.</p>
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
                <p className="text-xs text-zinc-500">
                  {fecha(a.creado)}
                  {a.email ? ` · ${a.email}` : ""}
                </p>
                {a.comentario && <p className="mt-1 whitespace-pre-line text-xs text-zinc-600">{a.comentario}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <a href={`/api/portal/materiales/descargar?id=${encodeURIComponent(a.id)}`} className={botonSecundario}>
                  Descargar
                </a>
                <button
                  type="button"
                  onClick={() => borrar(a)}
                  disabled={borrando === a.id}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
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
      setError("La duración tiene que ser un número de minutos (sin decimales).");
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
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
    setGuardando(false);
  }

  const campo = (clave: keyof typeof valores, etiqueta: string, max: number, tipo = "text") => (
    <div>
      <label className="campo-label" htmlFor={`${clave}-${e.id}`}>
        {etiqueta}
      </label>
      <input
        id={`${clave}-${e.id}`}
        type={tipo}
        className="campo-input"
        maxLength={tipo === "text" ? max : undefined}
        min={tipo === "number" ? 1 : undefined}
        max={tipo === "number" ? max : undefined}
        inputMode={tipo === "number" ? "numeric" : undefined}
        value={valores[clave]}
        onChange={(ev) => setValores((v) => ({ ...v, [clave]: ev.target.value }))}
      />
    </div>
  );

  return (
    <Bloque titulo="Datos del ponente">
      <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2">
        {campo("ponente_nombre", "Nombre del ponente", 200)}
        {campo("ponente_cargo", "Cargo", 200)}
        <div className="sm:col-span-2">{campo("ponencia_titulo", "Título de la ponencia", 300)}</div>
        {campo("ponencia_duracion_min", "Duración (minutos)", 600, "number")}
        <div className="flex flex-col gap-3 sm:col-span-2">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {ok && <Aviso tipo="ok">Datos del ponente guardados.</Aviso>}
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

function TarjetaEmpresa({ e, recargar }: { e: EmpresaMaterial; recargar: () => void }) {
  const hayParticulares = Boolean(e.particularesIncluidos || e.particularesExcluidos);
  return (
    <div className="flex flex-col gap-4 rounded-md border border-[var(--borde)] p-4">
      <div>
        <p className="font-semibold text-zinc-800">{e.empresa ?? "Empresa patrocinadora"}</p>
        {e.categoria && <p className="text-sm text-zinc-600">Patrocinio: {e.categoria}</p>}
      </div>

      {(e.incluye || hayParticulares) && (
        <Bloque titulo="Qué incluye tu patrocinio">
          {e.incluye && <p className="whitespace-pre-line text-sm text-zinc-700">{e.incluye}</p>}
          {hayParticulares && (
            <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
              <p className="mb-1 font-semibold">Condiciones particulares</p>
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
      )}

      <Produccion e={e} onGuardado={recargar} />
      <Subir e={e} onSubido={recargar} />
      <Subidos e={e} onBorrado={recargar} />

      {e.organizacion.length > 0 && (
        <Bloque titulo="Documentos de la organización">
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
      )}

      {e.ponente && <DatosPonente e={e} ponente={e.ponente} onGuardado={recargar} />}
    </div>
  );
}

async function obtenerMateriales(): Promise<EmpresaMaterial[]> {
  const res = await fetch("/api/portal/materiales", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo cargar el material.");
  return data.empresas;
}

export default function MaterialPatrocinador() {
  const [empresas, setEmpresas] = useState<EmpresaMaterial[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = () =>
    obtenerMateriales()
      .then((lista) => {
        setEmpresas(lista);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error inesperado."));

  useEffect(() => {
    obtenerMateriales()
      .then(setEmpresas)
      .catch((e) => setError(e instanceof Error ? e.message : "Error inesperado."));
  }, []);

  if (empresas && empresas.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-zinc-800">Material para el congreso</h2>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!empresas && !error && <p className="text-sm text-zinc-500">Cargando…</p>}
      <div className="flex flex-col gap-4">
        {empresas?.map((e) => (
          <TarjetaEmpresa key={e.id} e={e} recargar={cargar} />
        ))}
      </div>
    </section>
  );
}
