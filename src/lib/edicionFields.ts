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
  {
    titulo: "Precios (compra online)",
    campos: [
      {
        key: "precio_congreso",
        label: "Precio Congreso (€)",
        tipo: "numero",
        nota: "Precio por entrada al comprar por el formulario público. Vacío = sin precio configurado todavía.",
      },
      {
        key: "precio_congreso_colegiado",
        label: "Precio Congreso colegiados (€)",
        tipo: "numero",
        nota: "Precio por entrada de Congreso para quien marque \"Soy colegiado\". Vacío = no se ofrece esa opción en el formulario público.",
      },
      {
        key: "precio_gala",
        label: "Precio Gala (€)",
        tipo: "numero",
        nota: "Precio por entrada al comprar por el formulario público. Vacío = sin precio configurado todavía.",
      },
      {
        key: "precio_excursion",
        label: "Precio Excursión (€)",
        tipo: "numero",
        nota: "Precio por entrada al comprar por el formulario público. Vacío = sin precio configurado todavía.",
      },
    ],
  },
  {
    titulo: "Material para patrocinadores",
    campos: [
      {
        key: "precio_rollup",
        label: "Precio rollup (€ + IVA, cada uno)",
        tipo: "numero",
        nota: "Producción de rollup de 150 × 200 cm que puede pedir cualquier patrocinador desde su área. Vacío o 0 = no se ofrece.",
      },
      {
        key: "precio_vinilado",
        label: "Precio vinilado del mostrador (€ + IVA)",
        tipo: "numero",
        nota: "Precio cerrado por el mostrador completo. Solo lo ven los patrocinadores con mostrador. Vacío o 0 = no se ofrece.",
      },
      {
        key: "texto_material_patrocinadores",
        label: "Medidas y condiciones (rollup y vinilado)",
        tipo: "texto-largo",
        nota: "Se muestra en el área de cada patrocinador, junto a los precios.",
      },
      {
        key: "incluye_diamante",
        label: "Qué incluye — Diamante",
        tipo: "texto-largo",
        nota: "Se muestra a los patrocinadores Diamante en su área (\"Qué incluye tu patrocinio\"). Una línea por beneficio.",
      },
      { key: "incluye_oro", label: "Qué incluye — Oro", tipo: "texto-largo" },
      {
        key: "incluye_plata",
        label: "Qué incluye — Plata",
        tipo: "texto-largo",
        nota: "Institucional y Personalizado ven lo que haya en \"Beneficios incluidos\" de su ficha.",
      },
    ],
  },
];
