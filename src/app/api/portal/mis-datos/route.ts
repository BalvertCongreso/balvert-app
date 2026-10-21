import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { NOMBRE_TABLA_SQL, construirDatosEntrada, type Tabla } from "@/lib/entradaDatos";
import {
  CAMPO_EMAIL,
  consultaEntradas,
  documentosVisibles,
  edicionPortal,
  idEdicionActiva,
  patronEmailExacto,
  sesionPortal,
} from "@/lib/portal";

export const runtime = "nodejs";

const TABLAS: Tabla[] = ["congreso", "gala", "excursion"];

// Solo se enseñan enlaces a recibos de Stripe, nunca otra URL que pudiera
// haber acabado en la columna.
const esReciboStripe = (url: unknown): url is string =>
  typeof url === "string" && url.startsWith("https://pay.stripe.com/");

interface CompraPortal {
  referencia: string;
  fecha: string | null;
  importe: number | null;
  reciboUrl: string | null;
  entradas: number;
  facturaSolicitada: string | null;
}

// Todo lo que ve la persona en /portal/inicio, leído con el email de SU
// sesión. No acepta ningún parámetro del navegador.
export async function GET() {
  const sesion = await sesionPortal();
  if (!sesion) {
    return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });
  }

  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  const edicion = await edicionPortal(supabase, edicionId);

  const entradas: {
    tabla: Tabla;
    id: string;
    nombre: string | null;
    evento: string;
    lugar: string;
    fechaHora: string;
    detalleLabel: string | null;
    detalleValor: string | null;
    generada: boolean;
    // Solo Congreso: "disponible" con el check-in hecho, "pendiente" antes,
    // "sin_nombre" si falta el nombre para imprimirlo. null en Gala/Excursión.
    certificado: "disponible" | "pendiente" | "sin_nombre" | null;
    // Para «Editar mis datos». Del documento solo si hay uno guardado: el
    // número no sale nunca hacia el navegador.
    edicion: {
      checkIn: boolean;
      tieneDocumento: boolean;
      telefono?: string | null;
      menu?: string | null;
      alergias?: string | null;
    };
  }[] = [];
  // Compras online (las que tienen referencia de pago de Stripe).
  const compras = new Map<string, CompraPortal>();

  if (edicionId) {
    for (const tabla of TABLAS) {
      const { data: filas, error } = await consultaEntradas(supabase, tabla, edicionId, sesion.email);
      if (error) {
        console.error(`portal/mis-datos: fallo leyendo ${tabla}`, error.code, error.message);
        return NextResponse.json({ error: "No se pudieron cargar tus datos." }, { status: 500 });
      }
      const { data: conDocumento } = await supabase
        .from(NOMBRE_TABLA_SQL[tabla])
        .select("id")
        .eq("edicion_id", edicionId)
        .ilike(CAMPO_EMAIL[tabla], patronEmailExacto(sesion.email))
        .not("documento_identidad", "is", null);
      const idsConDocumento = new Set((conDocumento ?? []).map((f) => f.id as string));
      for (const fila of (filas ?? []) as unknown as Record<string, unknown>[]) {
        const datos = await construirDatosEntrada(supabase, tabla, fila);
        entradas.push({
          tabla,
          id: fila.id as string,
          nombre: datos.nombreAsistente,
          evento: datos.evento,
          lugar: datos.lugar,
          fechaHora: datos.fechaHora,
          detalleLabel: datos.detalleLabel,
          detalleValor: datos.detalleValor,
          generada: Boolean(fila.qr_codigo),
          certificado:
            tabla !== "congreso"
              ? null
              : fila.check_in_hecho !== "Sí"
                ? "pendiente"
                : typeof fila.nombre === "string" && fila.nombre.trim()
                  ? "disponible"
                  : "sin_nombre",
          edicion: {
            checkIn: fila.check_in_hecho === "Sí",
            tieneDocumento: idsConDocumento.has(fila.id as string),
            ...(tabla === "congreso" ? { telefono: (fila.telefono as string | null) ?? null } : {}),
            ...(tabla === "gala"
              ? { menu: (fila.menu as string | null) ?? null, alergias: (fila.alergias_intolerancias as string | null) ?? null }
              : {}),
          },
        });

        const referencia = fila.referencia_pago_online as string | null;
        if (referencia) {
          const compra = compras.get(referencia) ?? {
            referencia,
            fecha: null,
            importe: null,
            reciboUrl: null,
            entradas: 0,
            facturaSolicitada: null,
          };
          compra.entradas += 1;
          if (!compra.reciboUrl && esReciboStripe(fila.recibo_url)) compra.reciboUrl = fila.recibo_url;
          compras.set(referencia, compra);
        }
      }
    }
  }

  if (compras.size > 0) {
    const referencias = [...compras.keys()];
    const [{ data: pendientes }, { data: solicitudes }] = await Promise.all([
      supabase
        .from("compras_pendientes")
        .select("referencia_pago_online, importe_total_cents, usada_en")
        .in("referencia_pago_online", referencias),
      supabase
        .from("solicitudes_factura")
        .select("referencia_pago_online, creado")
        .in("referencia_pago_online", referencias),
    ]);
    for (const p of pendientes ?? []) {
      const compra = compras.get(p.referencia_pago_online);
      if (compra) {
        compra.importe = p.importe_total_cents / 100;
        compra.fecha = p.usada_en;
      }
    }
    for (const s of solicitudes ?? []) {
      const compra = compras.get(s.referencia_pago_online);
      if (compra) compra.facturaSolicitada = s.creado;
    }
  }

  let documentos: { id: string; titulo: string; descripcion: string | null; nombre_archivo: string; destino: string; creado: string }[] = [];
  if (edicionId) {
    try {
      // Sin ruta_archivo: la descarga va siempre por /api/portal/documento.
      documentos = (await documentosVisibles(supabase, edicionId, sesion.email)).map(
        ({ id, titulo, descripcion, nombre_archivo, destino, creado }) => ({ id, titulo, descripcion, nombre_archivo, destino, creado })
      );
    } catch (e) {
      console.error("portal/mis-datos:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "No se pudieron cargar tus datos." }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      email: sesion.email,
      edicionNombre: edicion.nombre,
      congreso: edicion.congreso,
      entradas,
      compras: [...compras.values()],
      documentos,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
