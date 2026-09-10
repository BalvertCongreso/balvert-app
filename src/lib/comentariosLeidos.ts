// Registro de "última vez que este usuario vio los comentarios de esta tarea",
// guardado en localStorage (por dispositivo/navegador, no sincronizado entre
// dispositivos) — suficiente para marcar comentarios como "🆕 Nuevo" sin tocar
// la base de datos.

function clave(usuario: string, tareaId: string): string {
  return `balvert_comentarios_leidos_${usuario}_${tareaId}`;
}

export function obtenerUltimaLectura(usuario: string, tareaId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(clave(usuario, tareaId));
}

export function marcarComentariosLeidos(usuario: string, tareaId: string, fechaISO: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(clave(usuario, tareaId), fechaISO);
}
