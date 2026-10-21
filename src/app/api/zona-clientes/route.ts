import { NextResponse } from "next/server";
import { crearClienteServicio, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { idEdicionActiva, normalizarEmail } from "@/lib/portal";
import { detalleCliente, listarClientes } from "@/lib/zonaClientes";

export const runtime = "nodejs";

// Zona de clientes del panel. GET ?q= (búsqueda por nombre, email o
// documento) para la lista; POST { email } para el espacio de una persona
// (por POST para que el email no vaya en la dirección). Solo con el login
// interno.
const sinSesion = () => NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });

export async function GET(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) return sinSesion();
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 100);
  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  if (!edicionId) return NextResponse.json({ clientes: [] });
  try {
    return NextResponse.json({ clientes: await listarClientes(supabase, edicionId, q) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("zona-clientes:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo cargar la lista de clientes." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await usuarioDesdeCabecera(req.headers.get("authorization")))) return sinSesion();
  const body = await req.json().catch(() => null);
  const email = normalizarEmail(body?.email);
  if (!email) return NextResponse.json({ error: "Falta el email." }, { status: 400 });
  const supabase = crearClienteServicio();
  const edicionId = await idEdicionActiva(supabase);
  const detalle = edicionId ? await detalleCliente(supabase, edicionId, email) : null;
  if (!detalle) return NextResponse.json({ error: "No hay entradas con ese email en la edición activa." }, { status: 404 });
  return NextResponse.json({ cliente: detalle }, { headers: { "Cache-Control": "no-store" } });
}
