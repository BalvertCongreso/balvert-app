import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { enviarEmailConEntrada } from "@/lib/entradaEmail";
import { formatearFechaHora, POR_CONFIRMAR } from "@/lib/entradaDatos";
import type { DatosEntrada } from "@/lib/entradaImagen";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Formulario público de autorregistro (Fase 2C-ii): no hay sesión con la que
// satisfacer las políticas RLS habituales (auth.uid()), así que esta ruta usa
// la clave "service_role" (salta RLS), solo en el servidor, y es el propio
// código de aquí abajo quien decide, de forma estricta, qué se puede guardar:
// únicamente nombre/email/teléfono/cargo de una inscripción "Independiente"
// "Pendiente" — nunca se lee ni se expone el resto de la tabla.
export async function POST(req: Request) {
  const body = await req.json();
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const telefono = typeof body.telefono === "string" && body.telefono.trim() ? body.telefono.trim() : null;
  const cargo = typeof body.cargo === "string" && body.cargo.trim() ? body.cargo.trim() : null;

  if (!nombre) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "El email no tiene un formato válido." }, { status: 400 });
  }

  const supabase = crearClienteServicio();

  const { data: edicion, error: errorEdicion } = await supabase
    .from("ediciones")
    .select("id, nombre, lugar_congreso, fecha_hora_congreso")
    .eq("activa", true)
    .maybeSingle();

  if (errorEdicion || !edicion) {
    return NextResponse.json(
      { error: "No hay ninguna edición activa configurada. Contacta con la organización." },
      { status: 500 }
    );
  }

  const qrCodigo = randomUUID();

  const { error: errorInsercion } = await supabase.from("asistentes_congreso").insert({
    id: randomUUID(),
    nombre,
    email,
    telefono,
    cargo,
    edicion_id: edicion.id,
    tipo_acceso: "Independiente",
    confirmado: "Pendiente",
    qr_codigo: qrCodigo,
  });

  if (errorInsercion) {
    // 23505 = ya existe una fila con este email en esta edición: actualiza
    // en vez de duplicar (incluida una entrada nueva, por si la anterior se
    // perdió o cambió algún dato). No se tocan tipo_acceso/confirmado, para
    // no deshacer una confirmación que el personal ya haya hecho a mano.
    if (errorInsercion.code === "23505") {
      const { error: errorActualizacion } = await supabase
        .from("asistentes_congreso")
        .update({ nombre, telefono, cargo, qr_codigo: qrCodigo })
        .eq("email", email)
        .eq("edicion_id", edicion.id);

      if (errorActualizacion) {
        return NextResponse.json({ error: "No se pudo actualizar tu inscripción." }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "No se pudo guardar la inscripción." }, { status: 500 });
    }
  }

  const datosEntrada: DatosEntrada = {
    qrPayload: `congreso:${qrCodigo}`,
    nombreAsistente: nombre,
    evento: "Congreso",
    edicionNombre: edicion.nombre,
    empresa: null,
    categoriaPatrocinio: null,
    detalleLabel: "Tipo de acceso",
    detalleValor: "Independiente",
    lugar: edicion.lugar_congreso || POR_CONFIRMAR,
    fechaHora: formatearFechaHora(edicion.fecha_hora_congreso),
  };

  const resultado = await enviarEmailConEntrada(email, "congreso", qrCodigo, datosEntrada);

  if (!resultado.enviado) {
    // La inscripción ya está guardada; solo ha fallado el email. Se informa
    // igual como éxito de inscripción, pero avisando del email.
    return NextResponse.json({ ok: true, enviado: false, aviso: resultado.error });
  }

  await supabase
    .from("asistentes_congreso")
    .update({ entrada_enviada: "Sí" })
    .eq("email", email)
    .eq("edicion_id", edicion.id);

  return NextResponse.json({ ok: true, enviado: true });
}
