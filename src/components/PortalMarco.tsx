// Marco común de las pantallas del portal de clientes (/portal/*): tarjeta
// blanca con la cabecera de BALVERT, igual que la compra de entradas.
export default function PortalMarco({
  subtitulo,
  ancho = "max-w-md",
  accion,
  children,
}: {
  subtitulo: string;
  ancho?: "max-w-md" | "max-w-2xl" | "max-w-3xl";
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto w-full ${ancho}`}>
      <div className="rounded-lg border border-[var(--borde)] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, var(--balvert-azul), var(--balvert-marron))" }}
            >
              B
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-[var(--balvert-marron)]">BALVERT 2027</p>
              <p className="text-xs leading-tight text-zinc-500">{subtitulo}</p>
            </div>
          </div>
          {accion}
        </div>
        {children}
      </div>
    </div>
  );
}
