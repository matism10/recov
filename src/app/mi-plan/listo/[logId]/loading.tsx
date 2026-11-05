// Esqueleto de la pantalla de felicitaciones: el mismo fondo celeste a pantalla completa.
export default function Loading() {
  return (
    <div aria-busy="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[#38BDF8]">
      <p role="status" className="sr-only">
        Guardando tu sesión…
      </p>
      <div aria-hidden="true" className="size-28 rounded-full bg-white/60 motion-safe:animate-pulse" />
    </div>
  );
}
