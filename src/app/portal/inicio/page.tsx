"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortalMarco from "@/components/PortalMarco";
import PortalZona, { ContactoZona, EtiquetaEstado, Tarjeta, type CongresoCabecera } from "@/components/PortalZona";
import { ORIGEN_PUBLICO } from "@/lib/dominio";
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
  congreso: CongresoCabecera | null;
  entradas: EntradaPortal[];
  compras: CompraPortal[];
  documentos: DocumentoPortal[];
}

const GRUPOS: { tabla: Tabla; titulo: string }[] = [
  { tabla: "congreso", titulo: "Congreso" },
  { tabla: "gala", titulo: "Cena de gala" },
  { tabla: "excursion", titulo: "Excursión" },
];

// Solo el QR, para el ticket (misma ruta y comprobación que la imagen).
function urlQr(e: EntradaPortal) {
  return `/api/portal/entrada?${new URLSearchParams({ tabla: e.tabla, id: e.id, qr: "1" })}`;
}

function urlEntrada(e: EntradaPortal, descargar: boolean) {
  // "v": cambia con los datos, para que el navegador no enseñe la imagen
  // anterior después de editarlos.
  const params = new URLSearchParams({ tabla: e.tabla, id: e.id, v: `${e.nombre ?? ""}|${e.detalleValor ?? ""}` });
  if (descargar) params.set("descargar", "1");
  return `/api/portal/entrada?${params}`;
}

const botonTicket =
  "inline-flex min-h-10 items-center rounded-[9px] bg-[#eef4f8] px-3 py-2 text-[13px] font-bold text-[var(--balvert-azul-oscuro)] hover:bg-[#e2edf4]";

// Una entrada como ticket (maqueta): datos a la izquierda y el QR a la
// derecha, separados por una línea discontinua. Al editar los datos, el
// formulario se abre debajo y el ticket ocupa toda la fila.
function TarjetaEntrada({ entrada, onEditada }: { entrada: EntradaPortal; onEditada: () => void }) {
  const [editando, setEditando] = useState(false);
  const tipo = GRUPOS.find((g) => g.tabla === entrada.tabla)?.titulo ?? entrada.evento;
  return (
    <div className={`overflow-hidden rounded-[14px] border border-[#e3e8ec] bg-white ${editando ? "min-[1000px]:col-span-2" : ""}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_104px] min-[760px]:grid-cols-[minmax(0,1fr)_128px]">
        <div className="flex flex-col gap-1 border-r-2 border-dashed border-[#e3e8ec] p-4 text-sm">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--balvert-marron)]">{tipo}</p>
          <h3 className="break-words text-base font-bold text-[#1f2a33]">{entrada.nombre ?? "Asistente"}</h3>
          <p className="text-[13px] text-[#5d6b76]">
            {entrada.fechaHora} · {entrada.lugar}
          </p>
          {entrada.detalleLabel && entrada.detalleValor && (
            <p className="text-[13px] text-[#5d6b76]">
              {entrada.detalleLabel}: {entrada.detalleValor}
            </p>
          )}
          <div className="mt-1.5">
            <EtiquetaEstado bien={entrada.generada}>{entrada.generada ? "Lista" : "En preparación"}</EtiquetaEstado>
          </div>
          {!entrada.generada && <p className="text-[13px] text-[#5d6b76]">Tu entrada aún no está lista. Te avisaremos por email.</p>}
          <div className="mt-2.5 flex flex-wrap gap-2">
            {entrada.generada && (
              <a href={urlEntrada(entrada, true)} className={botonTicket}>
                Descargar
              </a>
            )}
            {!editando && (
              <button type="button" onClick={() => setEditando(true)} className={botonTicket}>
                Editar mis datos
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center bg-[#f7fafc] p-2">
          {entrada.generada ? (
            // Pulsando el QR se abre la entrada completa (para enseñarla en el móvil).
            <a href={urlEntrada(entrada, false)} target="_blank" rel="noopener noreferrer" title="Ver la entrada completa">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urlQr(entrada)}
                alt={`Código QR de la entrada de ${tipo}`}
                loading="lazy"
                className="h-[84px] w-[84px] rounded-md min-[760px]:h-[104px] min-[760px]:w-[104px]"
              />
            </a>
          ) : (
            <span className="text-center text-xs text-[#5d6b76]">QR pendiente</span>
          )}
        </div>
      </div>
      {editando && (
        <div className="border-t border-[#e3e8ec] p-4 text-sm">
          <EditarMisDatos
            entrada={entrada}
            onCerrar={() => setEditando(false)}
            onGuardado={() => {
              setEditando(false);
              onEditada();
            }}
          />
        </div>
      )}
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
    <form onSubmit={guardar} className="flex flex-col gap-3">
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
function Certificado({ entrada, conNombre }: { entrada: EntradaPortal; conNombre: boolean }) {
  return (
    <Tarjeta titulo={`Certificado de asistencia${conNombre && entrada.nombre ? ` — ${entrada.nombre}` : ""}`}>
      {entrada.certificado === "disponible" ? (
        <>
          <p className="mb-3 text-sm text-[#5d6b76]">Ya puedes descargar tu certificado de asistencia en PDF.</p>
          <a
            href={`/api/portal/certificado?id=${encodeURIComponent(entrada.id)}`}
            className="inline-flex min-h-11 items-center rounded-[10px] bg-[var(--balvert-azul-oscuro)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            Descargar certificado de asistencia
          </a>
        </>
      ) : entrada.certificado === "sin_nombre" ? (
        <>
          <p className="mb-3 text-sm text-[#5d6b76]">
            Para preparar tu certificado necesitamos tu nombre completo. Escríbenos a secretaria@balvert.es.
          </p>
          <EtiquetaEstado bien={false}>Falta tu nombre</EtiquetaEstado>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-[#5d6b76]">
            Tu certificado estará disponible aquí cuando se registre tu entrada en el congreso.
          </p>
          <EtiquetaEstado bien={false}>Disponible tras el check-in</EtiquetaEstado>
        </>
      )}
    </Tarjeta>
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
    <div className="rounded-[14px] border border-[#e3e8ec] bg-white p-5 text-sm">
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
type Pestana = "entradas" | "compras" | "documentos";

const PESTANAS: { id: Pestana; titulo: string; intro: string }[] = [
  {
    id: "entradas",
    titulo: "Mis entradas",
    intro:
      "Enseña el QR en la entrada de cada evento, en el móvil o impreso. Aquí tendrás también tu certificado de asistencia después del congreso.",
  },
  {
    id: "compras",
    titulo: "Compras y facturas",
    intro: "Aquí tienes el recibo de cada pago. Si necesitas factura, pídela y te la enviaremos por email.",
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
    <Suspense fallback={<Cargando />}>
      <AreaCliente />
    </Suspense>
  );
}

function Cargando({ children }: { children?: React.ReactNode }) {
  return (
    <div className="px-6 py-8">
      <PortalMarco subtitulo="Área de clientes" ancho="max-w-3xl">
        {children ?? <p className="text-sm text-zinc-500">Cargando…</p>}
      </PortalMarco>
    </div>
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

  const tieneEntradas = datos.entradas.length > 0 || datos.compras.length > 0;
  const tieneDocumentos = datos.documentos.length > 0;

  // Las pestañas con contenido («Mis entradas» y «Documentos» si no hay nada).
  const visibles: Pestana[] = [];
  if (tieneEntradas || !tieneDocumentos) visibles.push("entradas");
  if (datos.compras.length > 0) visibles.push("compras");
  if (tieneDocumentos || !tieneEntradas) visibles.push("documentos");

  const pedida = searchParams.get("pestana") as Pestana | null;
  const pestana: Pestana = pedida && visibles.includes(pedida) ? pedida : visibles[0];
  const info = PESTANAS.find((p) => p.id === pestana)!;

  const irA = (p: Pestana) => router.replace(`/portal/inicio?pestana=${p}`, { scroll: false });

  // «Hola, Ana»: el nombre de la primera entrada a su nombre.
  const nombre = datos.entradas.find((e) => e.nombre?.trim())?.nombre?.trim().split(/\s+/)[0];
  const ordenadas = GRUPOS.flatMap(({ tabla }) => datos.entradas.filter((e) => e.tabla === tabla));
  const conCertificado = datos.entradas.filter((e) => e.certificado);

  return (
    <PortalZona
      subtitulo={`Área de clientes${datos.edicionNombre ? ` — ${datos.edicionNombre}` : ""}`}
      saludo={nombre ? `Hola, ${nombre}` : "Hola"}
      congreso={datos.congreso}
      pestanas={visibles.map((id) => ({ id, titulo: PESTANAS.find((p) => p.id === id)!.titulo }))}
      activa={pestana}
      onIr={irA}
      onSalir={salir}
      saliendo={saliendo}
    >
      <Tarjeta titulo={info.titulo} nivel={2} ayuda={info.intro}>
        <p className="break-words text-xs text-[#5d6b76]">Has entrado como {datos.email}</p>
      </Tarjeta>

      {pestana === "entradas" && (
        <>
          {datos.entradas.length === 0 ? (
            <Aviso tipo="info">
              No tienes entradas a tu nombre en esta edición. Si crees que es un error, escríbenos a
              secretaria@balvert.es.
            </Aviso>
          ) : (
            <div className="grid gap-4 min-[1000px]:grid-cols-2">
              {ordenadas.map((e) => (
                <TarjetaEntrada key={`${e.tabla}-${e.id}`} entrada={e} onEditada={() => setVersion((v) => v + 1)} />
              ))}
            </div>
          )}
          <div className="grid gap-4 min-[1000px]:grid-cols-2">
            <Tarjeta titulo="¿Te falta alguna entrada?" ayuda="Congreso, cena de gala y excursión. Pago con tarjeta, IVA incluido.">
              <a
                href={`${ORIGEN_PUBLICO}/entradas`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-[10px] bg-[var(--balvert-azul-oscuro)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
              >
                Comprar entradas
              </a>
            </Tarjeta>
            {conCertificado.map((e) => (
              <Certificado key={e.id} entrada={e} conNombre={conCertificado.length > 1} />
            ))}
          </div>
        </>
      )}

      {pestana === "compras" && (
        <div className="flex flex-col gap-4">
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
      )}

      {pestana === "documentos" && (
        <>
          {!tieneDocumentos && (
            <Aviso tipo="info">
              Todavía no hay documentos para ti. Cuando la organización comparta alguno (por ejemplo, tu factura), aparecerá
              aquí y te avisaremos por email.
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
                    href={`/api/portal/documento?id=${encodeURIComponent(d.id)}`}
                    className="inline-flex min-h-11 shrink-0 items-center self-start rounded-[9px] bg-[#eef4f8] px-4 py-2 text-sm font-bold text-[var(--balvert-azul-oscuro)] hover:bg-[#e2edf4] sm:self-auto"
                  >
                    Descargar
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ContactoZona />
    </PortalZona>
  );
}
