import NotasBoard from "@/components/NotasBoard";

export default function NotasEquipoPage() {
  return (
    <NotasBoard
      tabla="notas_compartidas"
      campoAutor="autor"
      filtrarPorUsuarioActual={false}
      titulo="Notas del equipo"
      descripcion="Tablón compartido: Ariadna y Ariosto ven y escriben aquí las mismas notas."
    />
  );
}
