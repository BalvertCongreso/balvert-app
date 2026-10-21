import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { crearClienteServidor, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { NOMBRE_TABLA_SQL, type Tabla } from "@/lib/entradaDatos";

// Genera la entrada (el código del QR) de una fila de Congreso, Gala o
// Excursión SIN enviar ningún email: después se descarga o se envía desde la
// ficha. No toca «Entrada enviada». Con la sesión del panel, para que el
// historial («Entrada generada: Sí», ver la migración 033) salga a su nombre.
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!(await usuarioDesdeCabecera(authHeader))) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const tabla = body?.tabla as Tabla;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!Object.hasOwn(NOMBRE_TABLA_SQL, tabla) || !id) {
    return NextResponse.json({ error: "Faltan datos (tabla o id)." }, { status: 400 });
  }

  const supabase = crearClienteServidor(authHeader);
  const tablaSql = NOMBRE_TABLA_SQL[tabla];
  const { data: fila } = await supabase.from(tablaSql).select("id, qr_codigo").eq("id", id).maybeSingle();
  if (!fila) return NextResponse.json({ error: "No se encontró el registro." }, { status: 404 });
  if (fila.qr_codigo) return NextResponse.json({ qr_codigo: fila.qr_codigo, yaEstaba: true });

  const qrCodigo = randomUUID();
  // Solo si sigue sin código (dos clics seguidos no generan dos distintos).
  const { data: guardada, error } = await supabase
    .from(tablaSql)
    .update({ qr_codigo: qrCodigo })
    .eq("id", id)
    .is("qr_codigo", null)
    .select("qr_codigo")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo generar la entrada." }, { status: 500 });
  if (!guardada) {
    const { data: actual } = await supabase.from(tablaSql).select("qr_codigo").eq("id", id).maybeSingle();
    return NextResponse.json({ qr_codigo: actual?.qr_codigo ?? null, yaEstaba: true });
  }
  return NextResponse.json({ qr_codigo: guardada.qr_codigo });
}
