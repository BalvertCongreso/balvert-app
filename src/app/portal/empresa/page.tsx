"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortalMarco from "@/components/PortalMarco";
import PortalZona, { ContactoZona, EtiquetaEstado, Tarjeta, type CongresoCabecera, type PestanaZona } from "@/components/PortalZona";
import {
  Aviso,
  DocumentosOrganizacion,
  SeccionMaterial,
  SeccionPatrocinio,
  SeccionPonencia,
  SeccionProduccion,
  tienePestanaPonencia,
  tieneProduccion,
  obtenerMateriales,
  type EmpresaMaterial,
} from "../inicio/MaterialPatrocinador";
import { DatosEmpresa, InvitacionesEmpresa } from "./SeccionesEmpresa";

// Zona de empresa del portal: se entra con el usuario y la contraseña de la
// empresa (ver src/lib/portalEmpresa.ts). Todo lo que se lee y guarda aquí
// pasa por /api/portal/materiales/* y /api/portal/empresa/*, que deciden la
// empresa con la sesión, nunca con lo que mande el navegador.

type Pestana =
  | "resumen"
  | "patrocinio"
  | "invitaciones"
  | "ponencia"
  | "produccion"
  | "material"
  | "documentos"
  | "datos"
  | "acceso";

// «Lo que os falta» (pestaña Resumen): lo calcula /api/portal/empresa/datos
// con los mismos pendientes que la Zona de patrocinadores del panel.
interface PasoResumen {
  titulo: string;
  detalle: string;
  hecho: boolean;
  pestana: "material" | "ponencia" | "invitaciones";
}

interface DatosEmpresa {
  usuario: string;
  empresa: string | null;
  categoria: string | null;
  edicionNombre: string | null;
  congreso: CongresoCabecera | null;
  deEstaEdicion: boolean;
  // «Ver como la empresa» desde el panel (sesión de la organización).
  modoOrganizacion: boolean;
  organizador: string | null;
  documentos: { id: string; titulo: string; descripcion: string | null; nombre_archivo: string }[];
  resumen: {
    pasos: PasoResumen[];
    invitados: { asignados: number; incluidos: number };
    ponencia: "recibida" | "pendiente" | "sin_responder" | null;
  } | null;
}

const PESTANAS: { id: Pestana; titulo: string; intro: string }[] = [
  {
    id: "resumen",
    titulo: "Resumen",
    intro: "Lo que os queda por hacer antes del congreso, de un vistazo.",
  },
  {
    id: "patrocinio",
    titulo: "Mi patrocinio",
    intro: "Aquí tienes lo que incluye tu patrocinio.",
  },
  {
    id: "invitaciones",
    titulo: "Invitaciones",
    intro:
      "Aquí tenéis a todos vuestros invitados. Podéis añadir a los que faltan (les enviamos su entrada al momento), descargar sus entradas para repartirlas y quitar o cambiar invitados.",
  },
  {
    id: "ponencia",
    titulo: "Ponencia",
    intro:
      "Aquí nos decís si vais a hacer ponencia, los datos del ponente y nos enviáis la presentación. Cuando la subáis, nos llega un aviso y la revisamos.",
  },
  {
    id: "produccion",
    titulo: "Rollups y vinilado",
    intro: "Si queréis, os los fabricamos nosotros. No se paga aquí: lo añadimos a vuestra factura.",
  },
  {
    id: "material",
    titulo: "Material",
    intro:
      "Aquí puedes enviarnos el logo de la empresa. Cuando lo subas, nos llega un aviso y lo revisamos. Los diseños de rollup y vinilado se suben en «Rollups y vinilado».",
  },
  {
    id: "documentos",
    titulo: "Documentos",
    intro: "Aquí encontrarás los documentos que la organización comparte con tu empresa. Pulsa «Descargar» para guardarlos.",
  },
  {
    id: "datos",
    titulo: "Datos de la empresa",
    intro: "Aquí podéis cambiar vuestras personas de contacto y los datos de facturación.",
  },
  {
    id: "acceso",
    titulo: "Contraseña",
    intro:
      "El usuario y la contraseña son de la empresa: los compartís las personas que trabajáis en el patrocinio. Si cambias la contraseña, se cerrará la sesión en los demás dispositivos.",
  },
];

// La categoría tal como se enseña en la cabecera: «⭐ ORO» → «⭐ Patrocinador Oro».
function etiquetaCategoria(categoria: string | null) {
  if (!categoria) return null;
  const m = categoria.match(/^(\S+)\s+(.+)$/);
  if (!m || !/[A-ZÁÉÍÓÚÑ]/.test(m[2])) return categoria;
  const nombre = m[2].charAt(0) + m[2].slice(1).toLowerCase();
  return `${m[1]} Patrocinador ${nombre}`;
}

export default function PortalEmpresaPage() {
  // useSearchParams necesita un Suspense alrededor.
  return (
    <Suspense fallback={<Cargando />}>
      <ZonaEmpresa />
    </Suspense>
  );
}

function Cargando({ children }: { children?: React.ReactNode }) {
  return (
    <div className="px-6 py-8">
      <PortalMarco subtitulo="Zona de patrocinadores" ancho="max-w-3xl">
        {children ?? <p className="text-sm text-zinc-500">Cargando…</p>}
      </PortalMarco>
    </div>
  );
}

function ZonaEmpresa() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [datos, setDatos] = useState<DatosEmpresa | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaMaterial | null | undefined>(undefined);
  const [errorEmpresa, setErrorEmpresa] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  const cargarDatos = () =>
    fetch("/api/portal/empresa/datos", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/portal");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar los datos. Recarga la página.");
        setDatos(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error inesperado. Recarga la página."));

  useEffect(() => {
    cargarDatos();
    obtenerMateriales()
      .then((lista) => setEmpresa(lista[0] ?? null))
      .catch((e) => setErrorEmpresa(e instanceof Error ? e.message : "Error inesperado."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const recargar = () => {
    obtenerMateriales()
      .then((lista) => {
        setEmpresa(lista[0] ?? null);
        setErrorEmpresa(null);
      })
      .catch((e) => setErrorEmpresa(e instanceof Error ? e.message : "Error inesperado."));
  };

  async function salir() {
    setSaliendo(true);
    await fetch("/api/portal/empresa/salir", { method: "POST" }).catch(() => null);
    router.replace("/portal");
  }

  // «Ver como la empresa»: cierra la sesión de la organización y la pestaña
  // (se abrió desde el panel); si el navegador no deja cerrarla, va a /portal.
  async function salirOrganizacion() {
    setSaliendo(true);
    await fetch("/api/portal/empresa/salir", { method: "POST" }).catch(() => null);
    window.close();
    router.replace("/portal");
  }

  if (error) {
    return (
      <Cargando>
        <Aviso tipo="error">{error}</Aviso>
        <button
          type="button"
          onClick={salir}
          disabled={saliendo}
          className="mt-4 min-h-11 rounded-md border border-[var(--borde)] px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
        >
          Cerrar sesión
        </button>
        <div className="mt-6">
          <ContactoZona />
        </div>
      </Cargando>
    );
  }
  if (!datos) return <Cargando />;

  const pedida = searchParams.get("pestana") as Pestana | null;
  // «Ponencia» y «Rollups y vinilado» solo para quien los tiene; «Contraseña»
  // no en modo organización.
  const visibles = PESTANAS.filter(
    (p) =>
      (p.id !== "ponencia" || (empresa && tienePestanaPonencia(empresa))) &&
      (p.id !== "produccion" || (empresa && tieneProduccion(empresa))) &&
      (p.id !== "acceso" || !datos.modoOrganizacion)
  );
  const pestana: Pestana = pedida && visibles.some((p) => p.id === pedida) ? pedida : "resumen";
  const info = PESTANAS.find((p) => p.id === pestana)!;
  const irA = (p: Pestana) => {
    // El resumen se vuelve a pedir al abrirlo: refleja lo guardado en las demás pestañas.
    if (p === "resumen") cargarDatos();
    router.replace(`/portal/empresa?pestana=${p}`, { scroll: false });
  };

  // Insignias del menú: lo pendiente de cada pestaña según el resumen.
  const pendientesDe = (id: Pestana) => datos.resumen?.pasos.filter((x) => x.pestana === id && !x.hecho).length ?? 0;
  const porAsignar = datos.resumen ? Math.max(0, datos.resumen.invitados.incluidos - datos.resumen.invitados.asignados) : 0;
  const insignia = (id: Pestana): number | string | null =>
    id === "invitaciones" ? porAsignar : id === "ponencia" || id === "material" ? (pendientesDe(id) > 0 ? "!" : null) : null;
  const pestanas: PestanaZona<Pestana>[] = visibles.map(({ id, titulo }) => ({ id, titulo, insignia: insignia(id) }));

  const numDocumentos = datos.documentos.length + (empresa?.organizacion.length ?? 0);

  return (
    <>
      {datos.modoOrganizacion && (
        <FranjaOrganizacion empresa={datos.empresa} onSalir={salirOrganizacion} saliendo={saliendo} />
      )}
      <PortalZona
        subtitulo={`Zona de patrocinadores${datos.edicionNombre ? ` — ${datos.edicionNombre}` : ""}`}
        saludo={`Hola, ${datos.empresa ?? "empresa patrocinadora"}`}
        etiqueta={etiquetaCategoria(datos.categoria)}
        congreso={datos.congreso}
        pestanas={pestanas}
        activa={pestana}
        onIr={irA}
        onSalir={datos.modoOrganizacion ? salirOrganizacion : salir}
        saliendo={saliendo}
      >
        {/* El resumen empieza directamente con «Lo que os falta», como en la maqueta. */}
        {pestana !== "resumen" && (
          <Tarjeta titulo={info.titulo} nivel={2} ayuda={info.intro}>
            {pestana === "acceso" && <p className="text-xs text-[#5d6b76]">Usuario: {datos.usuario}</p>}
          </Tarjeta>
        )}

        {pestana === "resumen" && (
          <Resumen datos={datos} numDocumentos={numDocumentos} irA={irA} />
        )}

        {(pestana === "patrocinio" || pestana === "material" || pestana === "ponencia" || pestana === "produccion") && (
          <>
            {errorEmpresa && <Aviso tipo="error">{errorEmpresa}</Aviso>}
            {empresa === undefined && !errorEmpresa && <p className="text-sm text-zinc-500">Cargando…</p>}
            {empresa === null && (
              <Aviso tipo="info">
                Tu patrocinio no está en la edición actual. Si crees que es un error, escríbenos a secretaria@balvert.es.
              </Aviso>
            )}
            {empresa && pestana === "patrocinio" && <SeccionPatrocinio e={empresa} />}
            {empresa && pestana === "produccion" && <SeccionProduccion key={empresa.id} e={empresa} onGuardado={recargar} />}
            {empresa && pestana === "ponencia" && <SeccionPonencia e={empresa} recargar={recargar} />}
            {empresa && pestana === "material" && (
              <SeccionMaterial e={empresa} recargar={recargar} irAProduccion={() => irA("produccion")} />
            )}
          </>
        )}

        {pestana === "documentos" && (
          <>
            {datos.documentos.length === 0 && (!empresa || empresa.organizacion.length === 0) && (
              <Aviso tipo="info">
                Todavía no hay documentos para tu empresa. Cuando la organización comparta alguno (por ejemplo, vuestra
                factura), aparecerá aquí.
              </Aviso>
            )}
            {datos.documentos.length > 0 && (
              <ul className="grid gap-4 min-[1000px]:grid-cols-2">
                {datos.documentos.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-3 rounded-[14px] border border-[#e3e8ec] bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-zinc-800">{d.titulo}</p>
                      {d.descripcion && <p className="whitespace-pre-line text-[#5d6b76]">{d.descripcion}</p>}
                    </div>
                    <a
                      href={`/api/portal/empresa/documento?id=${encodeURIComponent(d.id)}`}
                      className="inline-flex min-h-11 shrink-0 items-center self-start rounded-[9px] bg-[#eef4f8] px-4 py-2 text-sm font-bold text-[var(--balvert-azul-oscuro)] hover:bg-[#e2edf4] sm:self-auto"
                    >
                      Descargar
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {empresa && <DocumentosOrganizacion empresas={[empresa]} />}
          </>
        )}

        {pestana === "invitaciones" && <InvitacionesEmpresa />}
        {pestana === "datos" && <DatosEmpresa />}
        {pestana === "acceso" && (
          <Tarjeta>
            <CambiarContrasena />
          </Tarjeta>
        )}

        <ContactoZona />
      </PortalZona>
    </>
  );
}

// Franja de «Ver como la empresa»: en el flujo de la página (sin hueco
// debajo) y fija arriba al bajar. Publica su alto en --alto-franja para que
// la fila de pestañas se quede justo debajo.
function FranjaOrganizacion({
  empresa,
  onSalir,
  saliendo,
}: {
  empresa: string | null;
  onSalir: () => void;
  saliendo: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const raiz = document.documentElement;
    const medir = () => raiz.style.setProperty("--alto-franja", `${el.offsetHeight}px`);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      obs.disconnect();
      raiz.style.removeProperty("--alto-franja");
    };
  }, []);
  return (
    <div
      ref={ref}
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 shadow"
    >
      <span>
        Estás viendo la zona de <strong>{empresa ?? "la empresa"}</strong> como organización. Lo que cambies quedará a tu
        nombre.
      </span>
      <button
        type="button"
        onClick={onSalir}
        disabled={saliendo}
        className="min-h-9 rounded-md border border-amber-400 bg-white px-3 py-1 font-semibold hover:bg-amber-50 disabled:opacity-60"
      >
        Salir
      </button>
    </div>
  );
}

// ---- Pestaña «Resumen» ----

function Resumen({
  datos,
  numDocumentos,
  irA,
}: {
  datos: DatosEmpresa;
  numDocumentos: number;
  irA: (p: Pestana) => void;
}) {
  const r = datos.resumen;
  if (!r) {
    return (
      <Aviso tipo="info">
        Tu patrocinio no está en la edición actual. Si crees que es un error, escríbenos a secretaria@balvert.es.
      </Aviso>
    );
  }
  const hechos = r.pasos.filter((p) => p.hecho).length;
  const total = r.pasos.length;
  const pct = total ? Math.round((hechos / total) * 100) : 100;
  const enlace = "min-h-11 whitespace-nowrap text-sm font-bold text-[var(--balvert-azul-oscuro)] hover:underline";
  const estadoPonencia = {
    recibida: { bien: true, texto: "Presentación recibida", ayuda: "Ya tenemos vuestra presentación." },
    pendiente: { bien: false, texto: "Pendiente", ayuda: "Datos del ponente y presentación." },
    sin_responder: { bien: false, texto: "Falta responder", ayuda: "Decidnos si vais a hacer ponencia." },
  } as const;

  return (
    <>
      <Tarjeta titulo="Lo que os falta" nivel={2} ayuda="Completad estos pasos antes del congreso. Os avisaremos si cambia algo.">
        <div className="flex justify-between text-sm">
          <b>
            {hechos} de {total} hechos
          </b>
          <span className="text-[#5d6b76]">{pct} %</span>
        </div>
        <div
          className="mb-4 mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#e7edf1]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i
            className="block h-full"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--balvert-azul), var(--balvert-azul-oscuro))" }}
          />
        </div>
        <ul className="grid gap-2">
          {r.pasos.map((p) => (
            <li key={p.titulo} className="flex items-center gap-3 rounded-[10px] border border-[#e3e8ec] px-3 py-2.5">
              <span
                aria-hidden="true"
                className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-sm font-extrabold ${
                  p.hecho ? "bg-[#e3f5ea] text-[#1f8a4c]" : "bg-[#fff3d6] text-[#a86a00]"
                }`}
              >
                {p.hecho ? "✓" : "!"}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                {p.titulo}
                <small className="block text-[#5d6b76]">
                  <span className="sr-only">{p.hecho ? "Hecho: " : "Pendiente: "}</span>
                  {p.detalle}
                </small>
              </span>
              {!p.hecho && (
                <button type="button" onClick={() => irA(p.pestana)} className={enlace}>
                  Completar →
                </button>
              )}
            </li>
          ))}
        </ul>
      </Tarjeta>

      <div className={`grid gap-4 ${r.ponencia ? "min-[900px]:grid-cols-3" : "min-[900px]:grid-cols-2"}`}>
        <Tarjeta titulo="Invitaciones">
          <p className="text-3xl font-extrabold text-[#163f57]">
            {r.invitados.asignados} / {r.invitados.incluidos}
          </p>
          <p className="mb-2 text-sm text-[#5d6b76]">asignadas al congreso</p>
          <button type="button" onClick={() => irA("invitaciones")} className={enlace}>
            Ver invitados →
          </button>
        </Tarjeta>
        {r.ponencia && (
          <Tarjeta titulo="Ponencia">
            <EtiquetaEstado bien={estadoPonencia[r.ponencia].bien}>{estadoPonencia[r.ponencia].texto}</EtiquetaEstado>
            <p className="mb-2 mt-2.5 text-sm text-[#5d6b76]">{estadoPonencia[r.ponencia].ayuda}</p>
            <button type="button" onClick={() => irA("ponencia")} className={enlace}>
              Ir a la ponencia →
            </button>
          </Tarjeta>
        )}
        <Tarjeta titulo="Documentos">
          <p className="text-3xl font-extrabold text-[#163f57]">{numDocumentos}</p>
          <p className="mb-2 text-sm text-[#5d6b76]">
            {numDocumentos === 1 ? "documento de la organización" : "documentos de la organización"}
          </p>
          <button type="button" onClick={() => irA("documentos")} className={enlace}>
            Ver documentos →
          </button>
        </Tarjeta>
      </div>
    </>
  );
}

const MIN_CONTRASENA = 10;

function CambiarContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (nueva.length < MIN_CONTRASENA) return setError(`La contraseña nueva tiene que tener al menos ${MIN_CONTRASENA} caracteres.`);
    if (nueva !== repetir) return setError("Las dos contraseñas nuevas no coinciden.");
    setGuardando(true);
    try {
      const res = await fetch("/api/portal/empresa/contrasena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual, nueva }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Tu sesión ha caducado. Vuelve a entrar.");
      if (!res.ok) throw new Error(data.error || "No se pudo cambiar la contraseña.");
      setOk(true);
      setActual("");
      setNueva("");
      setRepetir("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
    setGuardando(false);
  }

  return (
    <form onSubmit={guardar} className="flex max-w-sm flex-col gap-4">
      {/* Para que el gestor de contraseñas sepa de qué cuenta es. */}
      <input type="text" autoComplete="username" hidden readOnly />
      <div>
        <label className="campo-label" htmlFor="actual">Contraseña actual</label>
        <input id="actual" type="password" required autoComplete="current-password" maxLength={200} className="campo-input" value={actual} onChange={(e) => setActual(e.target.value)} />
      </div>
      <div>
        <label className="campo-label" htmlFor="nueva">Contraseña nueva</label>
        <input id="nueva" type="password" required autoComplete="new-password" minLength={MIN_CONTRASENA} maxLength={200} className="campo-input" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <p className="mt-1 text-xs text-zinc-500">Mínimo {MIN_CONTRASENA} caracteres.</p>
      </div>
      <div>
        <label className="campo-label" htmlFor="repetir">Repite la contraseña nueva</label>
        <input id="repetir" type="password" required autoComplete="new-password" maxLength={200} className="campo-input" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">Contraseña cambiada. Se ha cerrado la sesión en los demás dispositivos.</Aviso>}
      <button
        type="submit"
        disabled={guardando}
        className="min-h-11 rounded-md bg-[var(--balvert-azul-oscuro)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
