"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortalMarco from "@/components/PortalMarco";
import {
  Aviso,
  DocumentosOrganizacion,
  SeccionMaterial,
  SeccionPatrocinio,
  obtenerMateriales,
  type EmpresaMaterial,
} from "./MaterialPatrocinador";
import { CAMPOS_FACTURACION, type DatosFacturacion } from "@/lib/factura";

type Tabla = "congreso" | "gala" | "excursion";

interface EntradaPortal {
  tabla: Tabla;
  id: string;
  nombre: string | null;
  evento: string;
  lugar: string;
  fechaHora: string;
  detalleLabel: string | null;
  detalleValor: string | null;
  generada: boolean;
  certificado: "disponible" | "pendiente" | "sin_nombre" | null;
}

interface CompraPortal {
  referencia: string;
  fecha: string | null;
  importe: number | null;
  reciboUrl: string | null;
  entradas: number;
  facturaSolicitada: string | null;
}

interface DocumentoPortal {
  id: string;
  titulo: string;
  descripcion: string | null;
  nombre_archivo: string;
}

interface DatosPortal {
  email: string;
  edicionNombre: string | null;
  entradas: EntradaPortal[];
  compras: CompraPortal[];
  empresas: { empresa: string | null; categoria: string | null }[];
  documentos: DocumentoPortal[];
}

const GRUPOS: { tabla: Tabla; titulo: string }[] = [
  { tabla: "congreso", titulo: "Congreso" },
  { tabla: "gala", titulo: "Cena de gala" },
  { tabla: "excursion", titulo: "Excursión" },
];

function urlEntrada(e: EntradaPortal, descargar: boolean) {
  const params = new URLSearchParams({ tabla: e.tabla, id: e.id });
  if (descargar) params.set("descargar", "1");
  return `/api/portal/entrada?${params}`;
}

function TarjetaEntrada({ entrada }: { entrada: EntradaPortal }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--borde)] p-4 sm:flex-row">
      {entrada.generada ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urlEntrada(entrada, false)}
          alt={`Entrada de ${entrada.evento}`}
          loading="lazy"
          className="w-full rounded-md border border-[var(--borde)] bg-zinc-50 sm:w-48"
        />
      ) : null}
      <div className="flex flex-1 flex-col gap-1 text-sm">
        <p className="font-semibold text-zinc-800">{entrada.nombre ?? "Asistente"}</p>
        <p className="text-zinc-600">Lugar: {entrada.lugar}</p>
        <p className="text-zinc-600">Fecha y hora: {entrada.fechaHora}</p>
        {entrada.detalleLabel && entrada.detalleValor && (
          <p className="text-zinc-600">
            {entrada.detalleLabel}: {entrada.detalleValor}
          </p>
        )}
        {entrada.generada ? (
          <a
            href={urlEntrada(entrada, true)}
            className="mt-2 self-start rounded-md border border-[var(--borde)] px-3 py-1.5 text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50"
          >
            Descargar entrada
          </a>
        ) : (
          <p className="mt-2 text-zinc-500">Tu entrada aún no está lista. Te avisaremos por email.</p>
        )}
        {entrada.certificado && <Certificado entrada={entrada} />}
      </div>
    </div>
  );
}

// Certificado de asistencia (solo Congreso): se descarga en cuanto se hace
// el check-in de la entrada. No se envía por email.
function Certificado({ entrada }: { entrada: EntradaPortal }) {
  return (
    <div className="mt-3 rounded-md border border-[var(--borde)] bg-zinc-50 p-3">
      <p className="font-semibold text-zinc-800">Certificado de asistencia</p>
      {entrada.certificado === "disponible" ? (
        <>
          <p className="mb-2 text-zinc-600">Ya puedes descargar tu certificado de asistencia en PDF.</p>
          <a
            href={`/api/portal/certificado?id=${encodeURIComponent(entrada.id)}`}
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--balvert-azul-oscuro)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Descargar certificado de asistencia
          </a>
        </>
      ) : entrada.certificado === "sin_nombre" ? (
        <p className="text-zinc-500">
          Para preparar tu certificado necesitamos tu nombre completo. Escríbenos a secretaria@balvert.es.
        </p>
      ) : (
        <p className="text-zinc-500">
          Tu certificado estará disponible aquí cuando se registre tu entrada en el congreso.
        </p>
      )}
    </div>
  );
}

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { dateStyle: "long" });

const facturaVacia = (): DatosFacturacion => ({
  razon_social: "",
  nif: "",
  direccion: "",
  codigo_postal: "",
  ciudad: "",
  pais: "España",
  email_factura: "",
});

// Una compra online: recibo de Stripe y petición de factura (que crea una
// tarea para la organización; la factura se envía después por email).
function TarjetaCompra({ compra, onSolicitada }: { compra: CompraPortal; onSolicitada: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<DatosFacturacion>(facturaVacia);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/factura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referencia: compra.referencia, datos }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo enviar la solicitud.");
      onSolicitada();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-md border border-[var(--borde)] p-4 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-zinc-800">
            Compra{compra.fecha ? ` del ${fechaCorta(compra.fecha)}` : ""}
            {compra.importe !== null ? ` · ${euros(compra.importe)}` : ""}
          </p>
          <p className="text-zinc-600">
            {compra.entradas} {compra.entradas === 1 ? "entrada" : "entradas"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {compra.reciboUrl && (
            <a
              href={compra.reciboUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-[var(--borde)] px-3 py-1.5 font-medium text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50"
            >
              Ver recibo del pago
            </a>
          )}
          {!compra.facturaSolicitada && !abierto && (
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="rounded-md border border-[var(--borde)] px-3 py-1.5 font-medium text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50"
            >
              Pedir factura
            </button>
          )}
        </div>
      </div>

      {compra.facturaSolicitada && (
        <p className="mt-3 rounded-md bg-zinc-50 p-3 text-zinc-600">
          Factura solicitada el {fechaCorta(compra.facturaSolicitada)}. Te la enviaremos por email.
        </p>
      )}

      {!compra.facturaSolicitada && abierto && (
        <form onSubmit={enviar} className="mt-4 flex flex-col gap-3 border-t border-[var(--borde)] pt-4">
          <p className="text-zinc-600">Indica los datos fiscales con los que quieres la factura.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPOS_FACTURACION.map(({ clave, etiqueta, maximo, opcional }) => (
              <div key={clave} className={clave === "razon_social" || clave === "direccion" ? "sm:col-span-2" : ""}>
                <label className="campo-label" htmlFor={`factura-${compra.referencia}-${clave}`}>
                  {etiqueta}
                  {opcional ? " (opcional)" : " *"}
                </label>
                <input
                  id={`factura-${compra.referencia}-${clave}`}
                  type={clave === "email_factura" ? "email" : "text"}
                  required={!opcional}
                  maxLength={maximo}
                  className="campo-input"
                  value={datos[clave] ?? ""}
                  onChange={(e) => setDatos((d) => ({ ...d, [clave]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={enviando}
              className="rounded-md bg-[var(--balvert-azul-oscuro)] px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Solicitar factura"}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-md border border-[var(--borde)] px-4 py-2 text-zinc-600 hover:bg-zinc-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

type Pestana = "entradas" | "patrocinio" | "material" | "documentos";

const PESTANAS: { id: Pestana; titulo: string; intro: string }[] = [
  {
    id: "entradas",
    titulo: "Mis entradas",
    intro:
      "Aquí tienes tus entradas con su código QR (enséñalo en el móvil o impreso al llegar), el recibo de cada pago y la opción de pedir factura.",
  },
  {
    id: "patrocinio",
    titulo: "Mi patrocinio",
    intro:
      "Aquí tienes lo que incluye tu patrocinio y puedes pedirnos que te fabriquemos rollups o el vinilado del mostrador. Los precios no incluyen IVA y se facturan después.",
  },
  {
    id: "material",
    titulo: "Material",
    intro:
      "Aquí puedes enviarnos el logo, la ponencia y los diseños de rollup y vinilado. Cuando subas algo, nos llega un aviso y lo revisamos.",
  },
  {
    id: "documentos",
    titulo: "Documentos",
    intro: "Aquí encontrarás los documentos que la organización comparte contigo. Pulsa «Descargar» para guardarlos.",
  },
];

export default function PortalInicioPage() {
  // useSearchParams necesita un Suspense alrededor.
  return (
    <Suspense
      fallback={
        <PortalMarco subtitulo="Área de clientes" ancho="max-w-3xl">
          <p className="text-sm text-zinc-500">Cargando…</p>
        </PortalMarco>
      }
    >
      <AreaCliente />
    </Suspense>
  );
}

function AreaCliente() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [datos, setDatos] = useState<DatosPortal | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaMaterial[] | null>(null);
  const [errorEmpresas, setErrorEmpresas] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    fetch("/api/portal/mis-datos", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/portal");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar tus datos. Recarga la página.");
        setDatos(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error inesperado. Recarga la página."));
    obtenerMateriales()
      .then(setEmpresas)
      .catch((e) => setErrorEmpresas(e instanceof Error ? e.message : "Error inesperado."));
  }, [router]);

  const recargarEmpresas = () => {
    obtenerMateriales()
      .then((lista) => {
        setEmpresas(lista);
        setErrorEmpresas(null);
      })
      .catch((e) => setErrorEmpresas(e instanceof Error ? e.message : "Error inesperado."));
  };

  async function salir() {
    setSaliendo(true);
    await fetch("/api/portal/salir", { method: "POST" }).catch(() => null);
    router.replace("/portal");
  }

  const botonSalir = (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      className="min-h-11 rounded-md border border-[var(--borde)] px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
    >
      Cerrar sesión
    </button>
  );

  if (error) {
    return (
      <PortalMarco subtitulo="Área de clientes" ancho="max-w-3xl" accion={botonSalir}>
        <Aviso tipo="error">{error}</Aviso>
        <Contacto />
      </PortalMarco>
    );
  }

  if (!datos) {
    return (
      <PortalMarco subtitulo="Área de clientes" ancho="max-w-3xl">
        <p className="text-sm text-zinc-500">Cargando…</p>
      </PortalMarco>
    );
  }

  const esPatrocinador = datos.empresas.length > 0;
  const tieneEntradas = datos.entradas.length > 0 || datos.compras.length > 0;
  const tieneDocumentos = datos.documentos.length > 0 || (empresas ?? []).some((e) => e.organizacion.length > 0);

  // Qué pestañas ve cada persona: un patrocinador, todas; un asistente,
  // "Mis entradas" y "Documentos" (o solo la que tenga contenido).
  let visibles: Pestana[];
  if (esPatrocinador) visibles = ["entradas", "patrocinio", "material", "documentos"];
  else if (tieneEntradas && !tieneDocumentos) visibles = ["entradas"];
  else if (!tieneEntradas && tieneDocumentos) visibles = ["documentos"];
  else visibles = ["entradas", "documentos"];

  const pedida = searchParams.get("pestana") as Pestana | null;
  const porDefecto: Pestana = esPatrocinador && !tieneEntradas ? "patrocinio" : visibles[0];
  const pestana: Pestana = pedida && visibles.includes(pedida) ? pedida : porDefecto;
  const info = PESTANAS.find((p) => p.id === pestana)!;

  const irA = (p: Pestana) => router.replace(`/portal/inicio?pestana=${p}`, { scroll: false });

  const empresa = empresas?.find((e) => e.id === empresaId) ?? empresas?.[0] ?? null;
  const usaEmpresa = pestana === "patrocinio" || pestana === "material";

  return (
    <PortalMarco
      subtitulo={`Área de clientes${datos.edicionNombre ? ` — ${datos.edicionNombre}` : ""}`}
      ancho="max-w-3xl"
      accion={botonSalir}
    >
      <p className="mb-4 break-words text-sm text-zinc-500">Has entrado como {datos.email}</p>

      {visibles.length > 1 && (
        <nav
          aria-label="Secciones de tu área"
          className="-mx-6 mb-5 flex gap-1 overflow-x-auto border-b border-[var(--borde)] px-6 sm:-mx-8 sm:px-8"
        >
          {visibles.map((id) => {
            const activa = id === pestana;
            return (
              <button
                key={id}
                type="button"
                onClick={() => irA(id)}
                aria-current={activa ? "page" : undefined}
                // En móvil la fila se desliza: que la pestaña abierta quede a la vista.
                ref={activa ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined}
                className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
                  activa
                    ? "border-[var(--balvert-azul-oscuro)] text-[var(--balvert-azul-oscuro)]"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {PESTANAS.find((p) => p.id === id)!.titulo}
              </button>
            );
          })}
        </nav>
      )}

      <h2 className="mb-1 text-lg font-semibold text-zinc-800">{info.titulo}</h2>
      <p className="mb-5 text-sm text-zinc-600">{info.intro}</p>

      {usaEmpresa && empresas && empresas.length > 1 && (
        <div className="mb-5">
          <label className="campo-label" htmlFor="selector-empresa">
            Empresa
          </label>
          <select
            id="selector-empresa"
            className="campo-input text-base sm:max-w-sm"
            value={empresa?.id ?? ""}
            onChange={(e) => setEmpresaId(e.target.value)}
          >
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.empresa ?? "Empresa sin nombre"}
                {e.categoria ? ` (${e.categoria})` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">Eres contacto de varias empresas: elige con cuál quieres trabajar.</p>
        </div>
      )}

      {usaEmpresa && (
        <>
          {errorEmpresas && <Aviso tipo="error">{errorEmpresas}</Aviso>}
          {!empresas && !errorEmpresas && <p className="text-sm text-zinc-500">Cargando…</p>}
          {empresa && (
            <div className="mb-4 rounded-md bg-zinc-50 p-3 text-sm">
              <p className="font-semibold text-zinc-800">{empresa.empresa ?? "Empresa patrocinadora"}</p>
              {empresa.categoria && <p className="text-zinc-600">Patrocinio: {empresa.categoria}</p>}
            </div>
          )}
          {empresa && pestana === "patrocinio" && (
            <SeccionPatrocinio key={empresa.id} e={empresa} recargar={recargarEmpresas} />
          )}
          {empresa && pestana === "material" && (
            <SeccionMaterial key={empresa.id} e={empresa} recargar={recargarEmpresas} irAPatrocinio={() => irA("patrocinio")} />
          )}
        </>
      )}

      {pestana === "entradas" && (
        <div className="flex flex-col gap-8">
          {datos.entradas.length === 0 ? (
            <Aviso tipo="info">
              No tienes entradas a tu nombre en esta edición. Si crees que es un error, escríbenos a
              secretaria@balvert.es.
            </Aviso>
          ) : (
            <div className="flex flex-col gap-6">
              {GRUPOS.map(({ tabla, titulo }) => {
                const delGrupo = datos.entradas.filter((e) => e.tabla === tabla);
                if (delGrupo.length === 0) return null;
                return (
                  <div key={tabla}>
                    <h3 className="mb-2 text-sm font-semibold text-[var(--balvert-marron)]">
                      {titulo} ({delGrupo.length})
                    </h3>
                    <div className="flex flex-col gap-3">
                      {delGrupo.map((e) => (
                        <TarjetaEntrada key={e.id} entrada={e} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {datos.compras.length > 0 && (
            <section>
              <h3 className="mb-1 text-base font-semibold text-zinc-800">Mis compras</h3>
              <p className="mb-3 text-sm text-zinc-600">
                Aquí tienes el recibo de cada pago. Si necesitas factura, pídela y te la enviaremos por email.
              </p>
              <div className="flex flex-col gap-3">
                {datos.compras.map((c) => (
                  <TarjetaCompra
                    key={c.referencia}
                    compra={c}
                    onSolicitada={() =>
                      setDatos(
                        (d) =>
                          d && {
                            ...d,
                            compras: d.compras.map((x) =>
                              x.referencia === c.referencia ? { ...x, facturaSolicitada: new Date().toISOString() } : x
                            ),
                          }
                      )
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {pestana === "documentos" && (
        <div className="flex flex-col gap-4">
          {!tieneDocumentos && (
            <Aviso tipo="info">
              Todavía no hay documentos para ti. Cuando la organización comparta alguno (por ejemplo, tu factura), aparecerá
              aquí y te avisaremos por email.
            </Aviso>
          )}
          {datos.documentos.length > 0 && (
            <ul className="flex flex-col gap-2">
              {datos.documentos.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col gap-2 rounded-md border border-[var(--borde)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="font-semibold text-zinc-800">{d.titulo}</p>
                    {d.descripcion && <p className="whitespace-pre-line text-zinc-600">{d.descripcion}</p>}
                  </div>
                  <a
                    href={`/api/portal/documento?id=${encodeURIComponent(d.id)}`}
                    className="inline-flex min-h-11 shrink-0 items-center self-start rounded-md border border-[var(--borde)] px-4 py-2 text-sm font-medium text-[var(--balvert-azul-oscuro)] hover:bg-zinc-50 sm:self-auto"
                  >
                    Descargar
                  </a>
                </li>
              ))}
            </ul>
          )}
          {empresas && <DocumentosOrganizacion empresas={empresas} />}
        </div>
      )}

      <Contacto />
    </PortalMarco>
  );
}

function Contacto() {
  return (
    <p className="mt-8 border-t border-[var(--borde)] pt-4 text-center text-sm text-zinc-600">
      ¿Dudas? Escríbenos a{" "}
      <a href="mailto:secretaria@balvert.es" className="font-medium text-[var(--balvert-azul-oscuro)] underline">
        secretaria@balvert.es
      </a>
    </p>
  );
}
