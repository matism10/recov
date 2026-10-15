// Foto de perfil redonda; sin foto, muestra las iniciales.
const SIZES = {
  sm: "size-9 text-xs",
  lg: "size-16 text-lg",
};

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
}: {
  name: string;
  url?: string | null;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-medium text-brand-text ${SIZES[size]}`}
    >
      {url ? (
        // URL firmada de Storage que vence: no pasa por next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}
