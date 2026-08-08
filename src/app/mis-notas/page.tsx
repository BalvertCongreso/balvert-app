import NotasBoard from "@/components/NotasBoard";

export default function MisNotasPage() {
  return (
    <NotasBoard
      tabla="notas_privadas"
      campoAutor="usuario"
      filtrarPorUsuarioActual={true}
      titulo="Mis notas"
      descripcion="Notas privadas: solo tú ves las que escribes aquí."
    />
  );
}
