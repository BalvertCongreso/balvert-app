import { NextResponse, after } from "next/server";
import { Resend } from "resend";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import {
  DURACION_ENLACE_MS,
  EMAIL_REGEX,
  MAX_ENLACES_POR_HORA,
  empresasDelEmail,
  generarToken,
  hashToken,
  idEdicionActiva,
  normalizarEmail,
  origenDeConfianza,
  tieneEntradas,
} from "@/lib/portal";

export const runtime = "nodejs";

const MENSAJE_GENERICO =
  "Si ese email tiene entradas o es de una empresa patrocinadora, te hemos enviado un enlace para entrar. Revisa tu bandeja de entrada (y la carpeta de spam). El enlace caduca en 15 minutos.";

function construirEmailHtml(enlace: string) {
  return `
  <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h1 style="color: #8B6914; font-size: 20px; margin-bottom: 4px;">BALVERT 2027</h1>
    <p style="color: #5BB8E8; font-weight: 600; margin-top: 0;">Acceso a tu área de cliente</p>
    <p>Hola,</p>
    <p>Pulsa el botón para entrar en tu área de BALVERT 2027, donde tienes tus entradas y documentos.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${enlace}" style="background: #2f7ea8; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Entrar en mi área</a>
    </div>
    <p style="font-size: 13px; color: #6b7280;">El enlace caduca en 15 minutos y solo se puede usar una vez. Si no lo has pedido tú, ignora este email: nadie podrá entrar sin él.</p>
  </div>
  `;
}

// Pide el enlace de acceso. Responde SIEMPRE lo mismo, exista o no el email,
// y todo el trabajo (consultas y envío) se hace después de responder, para
// que tampoco el tiempo de respuesta delate si el email está dado de alta.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = normalizarEmail(body?.email);
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return NextResponse.json({ error: "El email no tiene un formato válido." }, { status: 400 });
  }

  const origen = origenDeConfianza(req);
  after(() => enviarEnlaceSiCorresponde(email, origen));

  return NextResponse.json({ mensaje: MENSAJE_GENERICO });
}

async function enviarEnlaceSiCorresponde(email: string, origen: string) {
  try {
    const supabase = crearClienteServicio();

    // Limpieza oportunista: enlaces de hace más de un día (ya caducados y
    // fuera de la ventana del límite por hora) y sesiones caducadas.
    const haceUnDia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("portal_enlaces").delete().lt("creado_en", haceUnDia);
    await supabase.from("portal_sesiones").delete().lt("expira_en", new Date().toISOString());

    const edicionId = await idEdicionActiva(supabase);
    if (!edicionId) return;

    const [conEntradas, empresas] = await Promise.all([
      tieneEntradas(supabase, edicionId, email),
      empresasDelEmail(supabase, edicionId, email),
    ]);
    if (!conEntradas && empresas.length === 0) return;

    // Anti-abuso: como mucho MAX_ENLACES_POR_HORA envíos por email y hora.
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: errorCuenta } = await supabase
      .from("portal_enlaces")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("creado_en", haceUnaHora);
    if (errorCuenta || (count ?? 0) >= MAX_ENLACES_POR_HORA) return;

    const token = generarToken();
    const { error: errorInsercion } = await supabase.from("portal_enlaces").insert({
      email,
      token_hash: hashToken(token),
      expira_en: new Date(Date.now() + DURACION_ENLACE_MS).toISOString(),
    });
    if (errorInsercion) {
      console.error("portal/solicitar: no se pudo guardar el enlace", errorInsercion.code, errorInsercion.message);
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("portal/solicitar: falta RESEND_API_KEY");
      return;
    }
    const enlace = `${origen}/portal/entrar?token=${encodeURIComponent(token)}`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: errorEnvio } = await resend.emails.send({
      from: "BALVERT 2027 <secretaria@balvert.es>",
      to: email,
      subject: "Tu enlace de acceso — BALVERT 2027",
      html: construirEmailHtml(enlace),
    });
    if (errorEnvio) console.error("portal/solicitar: el email falló", errorEnvio.message);
  } catch (e) {
    console.error("portal/solicitar: error inesperado", e instanceof Error ? e.message : e);
  }
}
