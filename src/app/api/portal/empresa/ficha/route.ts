import { NextResponse } from "next/server";
import { Resend } from "resend";
import { crearClienteServicio } from "@/lib/supabaseServidor";
import { EMAIL_REGEX } from "@/lib/portal";
import { ORIGEN_PUBLICO } from "@/lib/dominio";
import { autorEmpresa, avisaASecretaria, claveAcciones, sesionEmpresa } from "@/lib/portalEmpresa";
import { actualizarFichaComo } from "@/lib/patrocinadorArchivos";
import { CAMPOS_EMPRESA, CAMPOS_FACTURACION_EMPRESA } from "@/lib/datosEmpresa";
import { LIMITE_CAMBIOS_POR_HORA, MENSAJE_LIMITE, accionesUltimaHora, registrarAccion } from "@/lib/portalMateriales";

export const runtime = "nodejs";

const COLUMNAS = ["empresa_entidad", ...CAMPOS_EMPRESA.map((c) => c.clave)].join(", ");

// Pestaña «Datos de la empresa» de la zona de empresa: contactos y
// facturación de SU ficha (la de la sesión), y ningún otro campo. Si cambia
// algo de facturación, se avisa por email a secretaría (antes → después); los
// contactos solo quedan en el historial. Cambiar el email de un contacto no
// da ni quita accesos (la zona de empresa va con usuario y contraseña).
export async function GET() {
  const sesion = await sesionEmpresa();
  if (!sesion) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 401 });
  const { data } = await crearClienteServicio()
    .from("patrocinadores")
    .select(CAMPOS_EMPRESA.map((c) => c.clave).join(", "))
    .eq("id", sesion.patrocinadorId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
  const campos = data as unknown as Record<string, string | null>;
  return NextResponse.json({ campos }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const sesion = await sesionEmpresa();
  if (!sesion) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, { status: 401 });
  const body = await req.json().catch(() => null);

  const nuevos: Record<string, string | null> = {};
  for (const c of CAMPOS_EMPRESA) {
    const valor = body?.[c.clave];
    if (valor === undefined) continue;
    if (valor !== null && typeof valor !== "string") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
    const limpio = (valor ?? "").trim();
    if (limpio.length > c.max) return NextResponse.json({ error: `${c.etiqueta}: demasiado largo.` }, { status: 400 });
    if (limpio && c.tipo === "email" && !EMAIL_REGEX.test(limpio)) {
      return NextResponse.json({ error: `${c.etiqueta}: el email no tiene un formato válido.` }, { status: 400 });
    }
    if (limpio && c.opciones && !c.opciones.includes(limpio)) {
      return NextResponse.json({ error: `${c.etiqueta}: opción no válida.` }, { status: 400 });
    }
    nuevos[c.clave] = limpio || null;
  }

  const supabase = crearClienteServicio();
  const { data } = await supabase.from("patrocinadores").select(COLUMNAS).eq("id", sesion.patrocinadorId).maybeSingle();
  const ficha = data as unknown as Record<string, string | null> | null;
  if (!ficha) return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });

  const cambios: Record<string, string | null> = {};
  for (const [clave, valor] of Object.entries(nuevos)) {
    if (valor !== (ficha[clave] ?? null)) cambios[clave] = valor;
  }
  if (Object.keys(cambios).length === 0) return NextResponse.json({ ok: true, sinCambios: true });

  const clave = claveAcciones(sesion);
  if ((await accionesUltimaHora(supabase, clave, ["datos_empresa"])) >= LIMITE_CAMBIOS_POR_HORA) {
    return NextResponse.json({ error: MENSAJE_LIMITE }, { status: 429 });
  }
  try {
    await actualizarFichaComo(supabase, sesion.patrocinadorId, autorEmpresa(sesion), cambios);
    await registrarAccion(supabase, clave, "datos_empresa", sesion.patrocinadorId);
  } catch (e) {
    console.error("portal/empresa/ficha:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo guardar. Inténtalo de nuevo." }, { status: 500 });
  }

  const deFacturacion = CAMPOS_FACTURACION_EMPRESA.filter((c) => c.clave in cambios);
  // Hecho por la organización («Ver como la empresa»): sin aviso.
  if (deFacturacion.length > 0 && avisaASecretaria(sesion)) {
    await avisarCambioFacturacion(
      ficha.empresa_entidad?.trim() || "Empresa sin nombre",
      sesion.patrocinadorId,
      autorEmpresa(sesion),
      deFacturacion.map((c) => ({ etiqueta: c.etiqueta, antes: ficha[c.clave] ?? null, despues: cambios[c.clave] }))
    );
  }
  return NextResponse.json({ ok: true });
}

function escaparHtml(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function avisarCambioFacturacion(
  empresa: string,
  patrocinadorId: string,
  autor: string,
  filas: { etiqueta: string; antes: string | null; despues: string | null }[]
) {
  if (!process.env.RESEND_API_KEY) {
    console.error("portal/empresa/ficha: falta RESEND_API_KEY, no se envía el aviso");
    return;
  }
  const enlace = `${ORIGEN_PUBLICO}/patrocinadores/${encodeURIComponent(patrocinadorId)}`;
  const tabla = filas
    .map(
      (f) => `<tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${escaparHtml(f.etiqueta)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${escaparHtml(f.antes ?? "—")}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${escaparHtml(f.despues ?? "—")}</td>
      </tr>`
    )
    .join("");
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: "BALVERT 2027 <secretaria@balvert.es>",
      to: "secretaria@balvert.es",
      subject: `${empresa} ha cambiado sus datos de facturación`,
      html: `
  <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h1 style="color: #8B6914; font-size: 20px; margin-bottom: 4px;">BALVERT 2027</h1>
    <p style="color: #5BB8E8; font-weight: 600; margin-top: 0;">Zona de patrocinadores</p>
    <p><strong>${escaparHtml(empresa)} ha cambiado sus datos de facturación</strong> (${escaparHtml(autor)}).</p>
    <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
      <tr><th align="left" style="padding: 6px 8px;">Dato</th><th align="left" style="padding: 6px 8px;">Antes</th><th align="left" style="padding: 6px 8px;">Después</th></tr>
      ${tabla}
    </table>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${enlace}" style="background: #2f7ea8; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Abrir la ficha</a>
    </div>
  </div>`,
    });
    if (error) console.error("portal/empresa/ficha: fallo enviando el aviso", error.message);
  } catch (e) {
    console.error("portal/empresa/ficha: fallo enviando el aviso", e instanceof Error ? e.message : e);
  }
}
