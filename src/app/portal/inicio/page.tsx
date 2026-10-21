"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortalMarco from "@/components/PortalMarco";
import ComprarEntradas from "@/components/ComprarEntradas";
import { Aviso } from "./MaterialPatrocinador";
import { CAMPOS_FACTURACION, type DatosFacturacion } from "@/lib/factura";
import {
  AYUDA_DOCUMENTO,
  TIPOS_DOCUMENTO,
  esTipoDocumento,
  nombreTieneApellidos,
  validarDocumento,
} from "@/lib/documentoIdentidad";
import { MENUS_GALA } from "@/lib/invitados";

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
  edicion: {
    checkIn: boolean;
    tieneDocumento: boolean;
    telefono?: string | null;
    menu?: string | null;
    alergias?: string | null;
  };
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
  documentos: DocumentoPortal[];
}

const GRUPOS: { tabla: Tabla; titulo: string }[] = [
  { tabla: "congreso", titulo: "Congreso" },
  { tabla: "gala", titulo: "Cena de gala" },
  { tabla: "excursion", titulo: "Excursión" },
];

function urlEntrada(e: EntradaPortal, descargar: boolean) {
  // "v": cambia con los datos, para que el navegador no enseñe la imagen
  // anterior después de editarlos.
  const params = new URLSearchParams({ tabla: e.tabla, id: e.id, v: `${e.nombre ?? ""}|${e.detalleValor ?? ""}` });
  if (descargar) params.set("descargar", "1");
  return `/api/portal/entrada?${params}`;
}

function TarjetaEntrada({ entrada, onEditada }: { entrada: EntradaPortal; onEditada: () => void }) {
  const [editando, setEditando] = useState(false);
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
        {editando ? (
          <EditarMisDatos
            entrada={entrada}
            onCerrar={() => setEditando(false)}
            onGuardado={() => {
              setEditando(false);
              onEditada();
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="mt-3 self-start text-sm font-medium text-[var(--balvert-azul-oscuro)] underline"
          >
            Editar mis datos
          </button>
        )}
      </div>
    </div>
  );
}

// Datos que la persona puede corregir de su entrada: nombre y documento hasta
// el check-in, teléfono (Congreso) y menú/alergias (Cena de gala). El email
// no: es su acceso. La imagen de la entrada y el certificado se generan al
// momento con los datos nuevos.
function EditarMisDatos({
  entrada,
  onCerrar,
  onGuardado,
}: {
  entrada: EntradaPortal;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const ed = entrada.edicion;
  const bloqueado = ed.checkIn;
  const [nombre, setNombre] = useState(entrada.nombre ?? "");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefono, setTelefono] = useState(ed.telefono ?? "");
  const [menu, setMenu] = useState(ed.menu ?? "");
  const [alergias, setAlergias] = useState(ed.alergias ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `${entrada.tabla}-${entrada.id}`;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cuerpo: Record<string, string> = { tabla: entrada.tabla, id: entrada.id };
    if (!bloqueado) {
      if (!nombreTieneApellidos(nombre)) return setError("Escribe tu nombre y tus apellidos.");
      cuerpo.nombre = nombre;
      if (documento.trim()) {
        if (!esTipoDocumento(tipoDocumento)) return setError("Elige el tipo de documento.");
        if (!validarDocumento(documento, tipoDocumento)) return setError(AYUDA_DOCUMENTO[tipoDocumento]);
        cuerpo.tipo_documento = tipoDocumento;
        cuerpo.documento = documento;
      }
    }
    if (entrada.tabla === "congreso") cuerpo.telefono = telefono;
    if (entrada.tabla === "gala") {
      if (!menu) return setError("Elige tu menú.");
      cuerpo.menu = menu;
      cuerpo.alergias = alergias;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/portal/mis-datos/editar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Tu sesión ha caducado. Vuelve a entrar con tu email.");
      if (!res.ok) throw new Error(data.error || "No se ha podido guardar.");
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="mt-3 flex flex-col gap-3 rounded-md border border-[var(--borde)] bg-zinc-50 p-3">
      <p className="font-semibold text-zinc-800">Editar mis datos</p>
      {bloqueado && (
        <p className="text-zinc-500">Ya no se puede modificar el nombre ni el documento: tu entrada ya está registrada.</p>
      )}
      <div>
        <label className="campo-label" htmlFor={`nombre-${id}`}>Nombre y apellidos</label>
        <input
          id={`nombre-${id}`}
          className="campo-input text-base disabled:bg-zinc-100 disabled:text-zinc-500"
          maxLength={150}
          disabled={bloqueado}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div>
          <label className="campo-label" htmlFor={`tipodoc-${id}`}>Documento</label>
          <select
            id={`tipodoc-${id}`}
            className="campo-input text-base disabled:bg-zinc-100"
            disabled={bloqueado}
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value)}
          >
            <option value=""></option>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="campo-label" htmlFor={`doc-${id}`}>Número</label>
          <input
            id={`doc-${id}`}
            className="campo-input text-base disabled:bg-zinc-100"
            maxLength={30}
            disabled={bloqueado}
            value={documento}
            placeholder={ed.tieneDocumento ? "Ya tienes uno guardado: déjalo vacío para no cambiarlo" : ""}
            onChange={(e) => setDocumento(e.target.value)}
          />
        </div>
      </div>
      {entrada.tabla === "congreso" && (
        <div>
          <label className="campo-label" htmlFor={`tel-${id}`}>Teléfono</label>
          <input
            id={`tel-${id}`}
            type="tel"
            className="campo-input text-base"
            maxLength={40}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>
      )}
      {entrada.tabla === "gala" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="campo-label" htmlFor={`menu-${id}`}>Menú</label>
            <select id={`menu-${id}`} className="campo-input text-base" value={menu} onChange={(e) => setMenu(e.target.value)}>
              <option value=""></option>
              {MENUS_GALA.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="campo-label" htmlFor={`alergias-${id}`}>Alergias o intolerancias</label>
            <input
              id={`alergias-${id}`}
              className="campo-input text-base"
              maxLength={500}
              value={alergias}
              onChange={(e) => setAlergias(e.target.value)}
            />
          </div>
        </div>
      )}
      <p className="text-xs text-zinc-500">Para cambiar tu email, escríbenos a secretaria@balvert.es.</p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={guardando}
          className="min-h-11 rounded-md bg-[var(--balvert-azul-oscuro)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={onCerrar} className="min-h-11 rounded-md border border-[var(--borde)] px-4 py-2 text-sm text-zinc-600">
          Cancelar
        </button>
      </div>
    </form>
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

// Zona personal (enlace al email). Lo de las empresas patrocinadoras está en
// la zona de empresa (/portal/empresa), con su usuario y contraseña.
type Pestana = "entradas" | "documentos";

const PESTANAS: { id: Pestana; titulo: string; intro: string }[] = [
  {
    id: "entradas",
    titulo: "Mis entradas",
    intro:
      "Aquí tienes tus entradas con su código QR (enséñalo en el móvil o impreso al llegar), tu certificado de asistencia después del congreso y, si las compraste, el recibo de cada pago y la opción de pedir factura.",
  },
  {
    id: "documentos",
    titulo: "Documentos",
    intro: "Aquí encontrarás los documentos para asistentes y los que la organización comparte contigo. Pulsa «Descargar» para guardarlos.",
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
  const [error, setError] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  const [version, setVersion] = useState(0);

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
  }, [router, version]);

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

  const tieneEntradas = datos.entradas.length > 0 || datos.compras.length > 0;
  const tieneDocumentos = datos.documentos.length > 0;

  // "Mis entradas" y "Documentos" (o solo la que tenga contenido).
  let visibles: Pestana[];
  if (tieneEntradas && !tieneDocumentos) visibles = ["entradas"];
  else if (!tieneEntradas && tieneDocumentos) visibles = ["documentos"];
  else visibles = ["entradas", "documentos"];

  const pedida = searchParams.get("pestana") as Pestana | null;
  const pestana: Pestana = pedida && visibles.includes(pedida) ? pedida : visibles[0];
  const info = PESTANAS.find((p) => p.id === pestana)!;

  const irA = (p: Pestana) => router.replace(`/portal/inicio?pestana=${p}`, { scroll: false });

  return (
    <PortalMarco
      subtitulo={`Área de clientes${datos.edicionNombre ? ` — ${datos.edicionNombre}` : ""}`}
      ancho="max-w-3xl"
      accion={botonSalir}
    >
      <p className="mb-4 break-words text-sm text-zinc-500">Has entrado como {datos.email}</p>
      <ComprarEntradas />

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
                        <TarjetaEntrada key={e.id} entrada={e} onEditada={() => setVersion((v) => v + 1)} />
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
