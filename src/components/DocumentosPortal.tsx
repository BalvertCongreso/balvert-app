// Documentos de las dos zonas del portal: una tarjeta por documento (icono
// según el tipo de archivo, título, etiqueta, fecha, descripción y
// «Descargar»), en secciones con título y los más recientes primero.

export interface DocumentoTarjeta {
  id: string;
  titulo: string;
  descripcion: string | null;
  nombreArchivo: string;
  // Etiqueta de tipo: Factura, Contrato, Documento…
  tipo: string;
  creado: string | null;
  href: string;
}

// Color e icono según la extensión del archivo.
const FAMILIAS: { extensiones: string[]; color: string }[] = [
  { extensiones: ["pdf"], color: "#d93025" },
  { extensiones: ["png", "jpg", "jpeg", "webp", "gif", "svg", "heic"], color: "#1e8e3e" },
  { extensiones: ["doc", "docx", "odt", "rtf"], color: "#1a73e8" },
  { extensiones: ["xls", "xlsx", "ods", "csv"], color: "#0f6b3a" },
  { extensiones: ["ppt", "pptx", "odp", "key"], color: "#e8710a" },
];

function extension(nombre: string) {
  const m = nombre.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}

function IconoArchivo({ ext }: { ext: string }) {
  const color = FAMILIAS.find((f) => f.extensiones.includes(ext))?.color ?? "#6b7280";
  return (
    <svg aria-hidden="true" width="40" height="48" viewBox="0 0 40 48" className="flex-none">
      <path d="M4 2h22l12 12v30a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill={color} />
      <path d="M26 2v10a2 2 0 0 0 2 2h10z" fill="#ffffff" opacity="0.45" />
      <rect x="9" y="24" width="20" height="3" rx="1.5" fill="#ffffff" opacity="0.85" />
      <rect x="9" y="31" width="20" height="3" rx="1.5" fill="#ffffff" opacity="0.85" />
      <rect x="9" y="38" width="13" height="3" rx="1.5" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");

function Tarjeta({ d }: { d: DocumentoTarjeta }) {
  const ext = extension(d.nombreArchivo);
  return (
    <li className="flex flex-col gap-3 rounded-[14px] border border-[#e3e8ec] bg-white p-5 transition-shadow hover:shadow-md">
      <div className="flex items-end gap-2">
        <IconoArchivo ext={ext} />
        {ext && <span className="text-xs font-bold uppercase tracking-wide text-[#5d6b76]">{ext}</span>}
      </div>
      <p className="line-clamp-2 break-words font-bold text-[#1f2a33]" title={d.titulo}>
        {d.titulo}
      </p>
      <p className="flex flex-wrap items-center gap-2 text-xs text-[#5d6b76]">
        <span className="rounded-full bg-[#eef4f8] px-2.5 py-0.5 font-bold text-[var(--balvert-azul-oscuro)]">{d.tipo}</span>
        {d.creado && <span>{fechaCorta(d.creado)}</span>}
      </p>
      {d.descripcion && <p className="line-clamp-2 break-words text-sm text-[#5d6b76]">{d.descripcion}</p>}
      <a
        href={d.href}
        className="mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[var(--balvert-azul-oscuro)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
      >
        Descargar
      </a>
    </li>
  );
}

export default function DocumentosPortal({ secciones }: { secciones: { titulo: string; documentos: DocumentoTarjeta[] }[] }) {
  const conDocumentos = secciones.filter((s) => s.documentos.length > 0);
  if (conDocumentos.length === 0) {
    return (
      <section className="rounded-[14px] border border-[#e3e8ec] bg-white p-5 text-sm text-[#5d6b76]">
        Todavía no hay documentos. Te avisaremos cuando subamos alguno.
      </section>
    );
  }
  return (
    <>
      {conDocumentos.map((s) => (
        <section key={s.titulo} className="flex flex-col gap-3">
          <h3 className="text-base font-bold text-[var(--balvert-marron)]">{s.titulo}</h3>
          <ul className="grid gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {[...s.documentos]
              .sort((a, b) => (b.creado ?? "").localeCompare(a.creado ?? ""))
              .map((d) => (
                <Tarjeta key={d.id} d={d} />
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}
