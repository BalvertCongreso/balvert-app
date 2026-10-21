// Pantalla «Zona de clientes» del panel: todas las personas con entradas de
// la edición activa (Congreso, Cena de gala, Excursión), agrupadas por email
// (un comprador puede tener varias entradas). Solo servidor, con la clave de
// servicio (compras, facturas pedidas, documentos personales y último acceso
// no tienen políticas). La ruta comprueba antes el login interno.
import type { SupabaseClient } from "@supabase/supabase-js";
import { NOMBRE_TABLA_SQL, type Tabla } from "@/lib/entradaDatos";
import { normalizarDocumento } from "@/lib/documentoIdentidad";
import { obtenerTodasLasFilas } from "@/lib/paginarTodo";

const TABLAS: Tabla[] = ["congreso", "gala", "excursion"];

const COLUMNAS: Record<Tabla, string> = {
  congreso:
    "id, nombre, email, documento_identidad, telefono, tipo_acceso, empresa_entidad, qr_codigo, entrada_enviada, check_in_hecho, referencia_pago_online, recibo_url",
  gala: "id, nombre_asistente, email_asistente, documento_identidad, tipo_entrada, menu, empresa_entidad, qr_codigo, entrada_enviada, check_in_hecho, referencia_pago_online, recibo_url",
  excursion:
    "id, nombre_asistente, email_asistente, documento_identidad, tipo_entrada, empresa_entidad, qr_codigo, entrada_enviada, check_in_hecho, referencia_pago_online, recibo_url",
};

export interface EntradaCliente {
  tabla: Tabla;
  id: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  tipo: string | null;
  menu: string | null;
  qrCodigo: string | null;
  entradaEnviada: "Sí" | "No" | null;
  checkIn: boolean;
  referencia: string | null;
}

export interface Cliente {
  email: string;
  nombres: string[];
  entradas: EntradaCliente[];
  compras: number;
  facturaPedida: boolean;
  certificado: boolean;
  ultimoAcceso: string | null;
}

interface Fila {
  entrada: EntradaCliente;
  documento: string | null;
  reciboUrl: string | null;
}

async function leerFilas(supabase: SupabaseClient, edicionId: string): Promise<Fila[]> {
  const filas: Fila[] = [];
  for (const tabla of TABLAS) {
    const datos = await obtenerTodasLasFilas<Record<string, unknown>>((desde, hasta) =>
      supabase
        .from(NOMBRE_TABLA_SQL[tabla])
        .select(COLUMNAS[tabla])
        .eq("edicion_id", edicionId)
        .order("id")
        .range(desde, hasta)
        .then(({ data, error }) => ({ data: data as unknown as Record<string, unknown>[] | null, error }))
    );
    for (const f of datos) {
      const email = ((tabla === "congreso" ? f.email : f.email_asistente) as string | null)?.trim().toLowerCase();
      if (!email) continue;
      filas.push({
        entrada: {
          tabla,
          id: f.id as string,
          nombre: ((tabla === "congreso" ? f.nombre : f.nombre_asistente) as string | null) ?? null,
          email,
          telefono: (f.telefono as string | null) ?? null,
          tipo: ((tabla === "congreso" ? f.tipo_acceso : f.tipo_entrada) as string | null) ?? null,
          menu: (f.menu as string | null) ?? null,
          qrCodigo: (f.qr_codigo as string | null) ?? null,
          entradaEnviada: (f.entrada_enviada as "Sí" | "No" | null) ?? null,
          checkIn: f.check_in_hecho === "Sí",
          referencia: (f.referencia_pago_online as string | null) ?? null,
        },
        documento: (f.documento_identidad as string | null) ?? null,
        reciboUrl: typeof f.recibo_url === "string" && f.recibo_url.startsWith("https://pay.stripe.com/") ? f.recibo_url : null,
      });
    }
  }
  return filas;
}

// Lista (con búsqueda por nombre, email o documento). El documento solo se
// usa para buscar: no sale en la respuesta.
export async function listarClientes(supabase: SupabaseClient, edicionId: string, busqueda: string): Promise<Cliente[]> {
  const filas = await leerFilas(supabase, edicionId);
  const termino = busqueda.trim().toLowerCase();
  const doc = normalizarDocumento(busqueda);
  const porEmail = new Map<string, Fila[]>();
  for (const f of filas) porEmail.set(f.entrada.email, [...(porEmail.get(f.entrada.email) ?? []), f]);

  const coincide = (lista: Fila[]) =>
    !termino ||
    lista.some(
      (f) =>
        f.entrada.email.includes(termino) ||
        (f.entrada.nombre ?? "").toLowerCase().includes(termino) ||
        (doc.length >= 4 && f.documento && normalizarDocumento(f.documento).includes(doc))
    );
  const elegidos = [...porEmail.entries()].filter(([, lista]) => coincide(lista));

  // Últimos accesos y facturas pedidas: las dos tablas enteras, por bloques, y
  // se cruzan aquí. Con .in() sobre todos los emails o referencias la petición
  // se hace demasiado larga en cuanto hay unos cientos de ventas.
  const [accesos, facturas] = await Promise.all([
    obtenerTodasLasFilas<{ email: string; ultimo_acceso: string }>((desde, hasta) =>
      supabase.from("clientes_accesos").select("email, ultimo_acceso").order("email").range(desde, hasta)
    ),
    obtenerTodasLasFilas<{ referencia_pago_online: string }>((desde, hasta) =>
      supabase.from("solicitudes_factura").select("referencia_pago_online").order("referencia_pago_online").range(desde, hasta)
    ),
  ]);
  const ultimoAcceso = new Map(accesos.map((a) => [a.email.toLowerCase(), a.ultimo_acceso]));
  const conFactura = new Set(facturas.map((f) => f.referencia_pago_online));

  return elegidos
    .map(([email, lista]): Cliente => {
      const refs = new Set(lista.map((f) => f.entrada.referencia).filter((r): r is string => !!r));
      return {
        email,
        nombres: [...new Set(lista.map((f) => f.entrada.nombre).filter((n): n is string => !!n))],
        entradas: lista.map((f) => f.entrada),
        compras: refs.size,
        facturaPedida: [...refs].some((r) => conFactura.has(r)),
        certificado: lista.some((f) => f.entrada.tabla === "congreso" && f.entrada.checkIn && !!f.entrada.nombre),
        ultimoAcceso: ultimoAcceso.get(email) ?? null,
      };
    })
    .sort((a, b) => (a.nombres[0] ?? a.email).localeCompare(b.nombres[0] ?? b.email, "es"));
}

export interface DetalleCliente extends Cliente {
  comprasDetalle: { referencia: string; fecha: string | null; importe: number | null; reciboUrl: string | null; entradas: number }[];
  facturas: { referencia: string; creado: string; datos: Record<string, string> }[];
  documentos: { id: string; titulo: string; descripcion: string | null; nombre_archivo: string; creado: string }[];
}

export async function detalleCliente(supabase: SupabaseClient, edicionId: string, email: string): Promise<DetalleCliente | null> {
  const filas = (await leerFilas(supabase, edicionId)).filter((f) => f.entrada.email === email);
  if (filas.length === 0) return null;
  const [base] = await listarClientes(supabase, edicionId, email).then((l) => l.filter((c) => c.email === email));
  const refs = [...new Set(filas.map((f) => f.entrada.referencia).filter((r): r is string => !!r))];
  const [compras, facturas, documentos] = await Promise.all([
    refs.length
      ? supabase.from("compras_pendientes").select("referencia_pago_online, importe_total_cents, usada_en").in("referencia_pago_online", refs)
      : { data: [] },
    refs.length
      ? supabase.from("solicitudes_factura").select("referencia_pago_online, creado, datos_facturacion").in("referencia_pago_online", refs)
      : { data: [] },
    supabase
      .from("documentos")
      .select("id, titulo, descripcion, nombre_archivo, creado")
      .eq("edicion_id", edicionId)
      .eq("destino", "asistente")
      .eq("email_destinatario", email)
      .order("creado", { ascending: false }),
  ]);
  return {
    ...base,
    comprasDetalle: refs.map((r) => {
      const c = (compras.data ?? []).find((x) => x.referencia_pago_online === r);
      return {
        referencia: r,
        fecha: (c?.usada_en as string | null) ?? null,
        importe: c ? (c.importe_total_cents as number) / 100 : null,
        reciboUrl: filas.find((f) => f.entrada.referencia === r && f.reciboUrl)?.reciboUrl ?? null,
        entradas: filas.filter((f) => f.entrada.referencia === r).length,
      };
    }),
    facturas: (facturas.data ?? []).map((f) => ({
      referencia: f.referencia_pago_online as string,
      creado: f.creado as string,
      datos: (f.datos_facturacion ?? {}) as Record<string, string>,
    })),
    documentos: (documentos.data ?? []) as DetalleCliente["documentos"],
  };
}
