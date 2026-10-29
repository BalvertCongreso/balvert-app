import { NextResponse } from "next/server";
import { crearClienteServidor, usuarioDesdeCabecera } from "@/lib/supabaseServidor";
import { sincronizarSuscriptor } from "@/lib/mailrelay";
import { normalizarEmail } from "@/lib/exclusiones";

interface ContactoLote {
  email: string;
  nombre: string | null;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const usuario = await usuarioDesdeCabecera(authHeader);
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no encontrada. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const body = await req.json();
  const groupId = body.groupId as number;
  const contactos = body.contactos as ContactoLote[];
  if (!groupId || !Array.isArray(contactos)) {
    return NextResponse.json({ error: "Faltan datos (groupId o contactos)." }, { status: 400 });
  }

  // Comprobación en el servidor, aunque el navegador ya filtre: solo se
  // sincronizan emails que son contactos Activos. Un excluido de envíos (o un
  // email que no está en Contactos) se descarta y nunca llega a Mailrelay.
  const emails = Array.from(new Set(contactos.map((c) => normalizarEmail(c?.email)).filter(Boolean)));
  const db = crearClienteServidor(authHeader);
  const activos = new Set<string>();
  for (let i = 0; i < emails.length; i += 200) {
    const { data, error } = await db
      .from("contactos_newsletter")
      .select("email")
      .in("email", emails.slice(i, i + 200))
      .eq("estado", "Activo");
    if (error) {
      return NextResponse.json({ error: "No se pudo comprobar el estado de los contactos: " + error.message }, { status: 500 });
    }
    for (const c of data ?? []) activos.add(normalizarEmail(c.email));
  }
  const yaVistos = new Set<string>();
  const aSincronizar: ContactoLote[] = [];
  for (const c of contactos) {
    const email = normalizarEmail(c?.email);
    if (!activos.has(email) || yaVistos.has(email)) continue;
    yaVistos.add(email);
    aSincronizar.push({ email, nombre: c.nombre ?? null });
  }
  const descartados = contactos.length - aSincronizar.length;

  const errores: string[] = [];
  // Uno a uno, en paralelo limitado, para no saturar la API de Mailrelay ni
  // que un solo fallo tire abajo todo el lote.
  const TAMANO_TANDA = 10;
  for (let i = 0; i < aSincronizar.length; i += TAMANO_TANDA) {
    const tanda = aSincronizar.slice(i, i + TAMANO_TANDA);
    const resultados = await Promise.allSettled(
      tanda.map((c) => sincronizarSuscriptor({ email: c.email, nombre: c.nombre, groupId }))
    );
    resultados.forEach((r, idx) => {
      if (r.status === "rejected") {
        errores.push(`${tanda[idx].email}: ${r.reason?.message ?? "error desconocido"}`);
      }
    });
  }

  return NextResponse.json({
    sincronizados: aSincronizar.length - errores.length,
    descartados,
    errores,
  });
}
