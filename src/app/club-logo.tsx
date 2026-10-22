// Logo del club en un cuadro redondeado; sin logo, muestra las iniciales del club.
const SIZES = {
  sm: "size-10 text-sm",
  lg: "size-20 text-xl",
};
// Tamaño en pantalla (px), para reservar el espacio de la imagen antes de que cargue.
const PX = { sm: 40, lg: 80 };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function ClubLogo({
  name,
  url,
  size = "sm",
}: {
  name: string;
  url?: string | null;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white font-display font-extrabold text-brand-text ${SIZES[size]}`}
    >
      {url ? (
        // Archivo público de Storage: no pasa por next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          width={PX[size]}
          height={PX[size]}
          decoding="async"
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}
