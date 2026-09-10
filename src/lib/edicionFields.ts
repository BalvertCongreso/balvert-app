import type { SeccionDef } from "./patrocinadorFields";

export const seccionesEdicion: SeccionDef[] = [
  {
    titulo: "Datos generales",
    campos: [
      { key: "nombre", label: "Nombre", tipo: "texto", nota: 'Ej. "BALVERT 2028"' },
      { key: "anio", label: "Año", tipo: "numero" },
      { key: "fecha_inicio", label: "Fecha de inicio", tipo: "fecha" },
      { key: "fecha_fin", label: "Fecha de fin", tipo: "fecha" },
      { key: "ciudad", label: "Ciudad", tipo: "texto" },
      {
        key: "activa",
        label: "Edición activa",
        tipo: "booleano",
        nota: "Solo puede haber una edición activa a la vez; marcarla aquí desmarca las demás.",
      },
    ],
  },
  {
    titulo: "Congreso — lugar y hora",
    campos: [
      { key: "lugar_congreso", label: "Lugar del congreso", tipo: "texto" },
      { key: "fecha_hora_congreso", label: "Fecha y hora del congreso", tipo: "fecha-hora" },
    ],
  },
  {
    titulo: "Gala — lugar y hora",
    campos: [
      { key: "lugar_gala", label: "Lugar de la gala", tipo: "texto" },
      { key: "fecha_hora_gala", label: "Fecha y hora de la gala", tipo: "fecha-hora" },
    ],
  },
  {
    titulo: "Excursión — lugar y hora",
    campos: [
      { key: "lugar_excursion", label: "Lugar de la excursión", tipo: "texto" },
      { key: "fecha_hora_excursion", label: "Fecha y hora de la excursión", tipo: "fecha-hora" },
    ],
  },
];
