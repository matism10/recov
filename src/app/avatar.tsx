// Foto de perfil redonda; sin foto, muestra las iniciales.
const SIZES = {
  sm: "size-9 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-lg",
};
// Tamaño en pantalla (px), para reservar el espacio de la imagen antes de que cargue.
const PX = { sm: 36, md: 40, lg: 64 };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function Avatar({
  name,
  url,
  size = "sm",
  onTint = false,
}: {
  name: string;
  url?: string | null;
  size?: keyof typeof SIZES;
  // Sobre un fondo celeste (sidebar), el círculo va en blanco para no perderse.
  onTint?: boolean;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${onTint ? "bg-white" : "bg-brand-soft"} font-medium text-brand-text ${SIZES[size]}`}
    >
      {url ? (
        // Foto privada por /foto (o una vista previa local): no pasa por next/image,
        // cuyo optimizador la pediría sin la sesión de quien mira.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          width={PX[size]}
          height={PX[size]}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}
