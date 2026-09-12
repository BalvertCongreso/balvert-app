import { redirect } from "next/navigation";

// Retirado en Fase 7c: el Congreso pasa a ser de pago y comparte formulario
// con Gala/Excursión en /entradas. Se deja esta redirección para no romper
// enlaces que alguien ya tuviera guardados de la versión gratuita anterior.
export default function InscripcionCongresoPage() {
  redirect("/entradas");
}
