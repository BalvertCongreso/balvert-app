import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { construirDatosEntrada, type Tabla } from "@/lib/entradaDatos";
import { consultaEntradas, documentosVisibles, empresasDelEmail, idEdicionActiva, sesionPortal } from "@/lib/portal";

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
  const { data: edicion } = edicionId
    ? await supabase.from("ediciones").select("nombre").eq("id", edicionId).maybeSingle()
    : { data: null };

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

  const empresas = edicionId ? await empresasDelEmail(supabase, edicionId, sesion.email) : [];
  let documentos: { id: string; titulo: string; descripcion: string | null; nombre_archivo: string }[] = [];
  if (edicionId) {
    try {
      // Sin ruta_archivo: la descarga va siempre por /api/portal/documento.
      documentos = (await documentosVisibles(supabase, edicionId, sesion.email)).map(
        ({ id, titulo, descripcion, nombre_archivo }) => ({ id, titulo, descripcion, nombre_archivo })
      );
    } catch (e) {
      console.error("portal/mis-datos:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "No se pudieron cargar tus datos." }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      email: sesion.email,
      edicionNombre: edicion?.nombre ?? null,
      entradas,
      compras: [...compras.values()],
      empresas: empresas.map((e) => ({ empresa: e.empresa, categoria: e.categoria })),
      documentos,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
