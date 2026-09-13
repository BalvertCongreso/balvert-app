import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { crearClienteServidor } from "@/lib/supabaseServidor";
import { enviarEmailConEntrada } from "@/lib/entradaEmail";
import {
  NOMBRE_TABLA_SQL,
  extraerNombreYEmail,
  construirDatosEntrada,
  type Tabla,
} from "@/lib/entradaDatos";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = await req.json();
  const tabla = body.tabla as Tabla;
  const id = body.id as string;

  // Reenvío puntual a un email distinto del guardado en la ficha (p.ej. si
  // alguien perdió su entrada): no toca el dato guardado, solo cambia a
  // dónde se manda este envío en concreto.
  const emailDestino = typeof body.emailDestino === "string" ? body.emailDestino.trim() : "";
  if (emailDestino && !EMAIL_REGEX.test(emailDestino)) {
    return NextResponse.json({ error: "El email de destino no tiene un formato válido." }, { status: 400 });
  }

  if (!tabla || !NOMBRE_TABLA_SQL[tabla] || !id) {
    return NextResponse.json({ error: "Faltan datos (tabla o id)." }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const supabase = crearClienteServidor(authHeader);
  const tablaSql = NOMBRE_TABLA_SQL[tabla];

  const { data: fila, error: errorLectura } = await supabase
    .from(tablaSql)
    .select("*")
    .eq("id", id)
    .single();

  if (errorLectura || !fila) {
    return NextResponse.json({ error: "No se encontró el registro." }, { status: 404 });
  }

  const { email } = extraerNombreYEmail(tabla, fila);
  const destinatario = emailDestino || email;

  // Reutiliza el código si ya existía (p.ej. al reenviar); si no, genera uno
  // nuevo. Es un identificador aparte del id de la fila (no el id en sí)
  // para poder revocar/regenerar una entrada sin tocar la fila original,
  // y porque no conviene exponer el id interno de la base de datos en un QR
  // que puede acabar fotografiado o reenviado por email.
  const qrCodigo: string = (fila.qr_codigo as string | null) || randomUUID();

  if (!fila.qr_codigo) {
    const { error: errorGuardado } = await supabase
      .from(tablaSql)
      .update({ qr_codigo: qrCodigo })
      .eq("id", id);
    if (errorGuardado) {
      return NextResponse.json({ error: "No se pudo guardar el código del QR." }, { status: 500 });
    }
  }

  if (!destinatario) {
    return NextResponse.json({ qr_codigo: qrCodigo, enviado: false, email: null });
  }

  const datosEntrada = await construirDatosEntrada(supabase, tabla, { ...fila, qr_codigo: qrCodigo });
  const resultado = await enviarEmailConEntrada(destinatario, tabla, qrCodigo, datosEntrada);

  if (!resultado.enviado) {
    return NextResponse.json({ qr_codigo: qrCodigo, enviado: false, error: resultado.error }, { status: 502 });
  }

  await supabase.from(tablaSql).update({ entrada_enviada: "Sí" }).eq("id", id);

  return NextResponse.json({ qr_codigo: qrCodigo, enviado: true, email: destinatario });
}
