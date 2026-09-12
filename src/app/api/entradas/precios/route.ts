import { NextResponse } from "next/server";
import { crearClienteServicio } from "@/lib/supabaseServidor";

// Lectura pública (sin sesión) de los precios de la edición activa, para que
// el formulario /entradas sepa qué secciones mostrar habilitadas. anon no
// tiene permiso de lectura sobre "ediciones" (ver 009_revertir_rls_publica.sql),
// así que esto usa la clave de servicio y solo expone los 3 campos de precio
// y el nombre — nada más de la tabla.
export async function GET() {
  const supabase = crearClienteServicio();

  const { data: edicion, error } = await supabase
    .from("ediciones")
    .select("id, nombre, precio_congreso, precio_gala, precio_excursion")
    .eq("activa", true)
    .maybeSingle();

  if (error || !edicion) {
    return NextResponse.json(
      { error: "No hay ninguna edición activa configurada. Contacta con la organización." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    edicionNombre: edicion.nombre,
    precioCongreso: edicion.precio_congreso,
    precioGala: edicion.precio_gala,
    precioExcursion: edicion.precio_excursion,
  });
}
