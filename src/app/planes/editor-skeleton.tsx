// Esqueleto del editor de planes: franja de 3 tarjetas, pestañas de sesiones con la
// tabla de ejercicios, vista previa y lesionados.
import { Block, Line } from "@/app/skeleton";

export function EditorSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 lg:max-w-[1200px] lg:px-8">
      <p role="status" className="sr-only">
        Cargando el plan…
      </p>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="space-y-3">
          <Line className="h-4 w-40" />
          <Line className="h-8 w-80 max-w-[80vw]" />
        </div>
        <div className="hidden gap-2 lg:flex">
          <Line className="h-11 w-36 rounded-xl" />
          <Line className="h-11 w-32 rounded-xl" />
        </div>
      </div>
      <div className="space-y-4 lg:space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.7fr_1.1fr]">
          <Block className="h-36" />
          <Block className="h-36" />
          <Block className="h-36" />
        </div>
        <Block className="p-4">
          <div className="mb-4 flex gap-2">
            <Line className="h-11 w-36 rounded-xl" />
            <Line className="h-11 w-36 rounded-xl" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Line key={i} className="h-11 w-full rounded-xl" />
            ))}
          </div>
        </Block>
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Block className="h-40" />
          <Block className="h-28" />
        </div>
      </div>
    </main>
  );
}
