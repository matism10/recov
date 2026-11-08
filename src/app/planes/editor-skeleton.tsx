// Esqueleto del editor de planes: nombre, asignación, pestañas de sesiones con la
// tabla de ejercicios y, en escritorio, el panel derecho.
import { Block, Line } from "@/app/skeleton";

export function EditorSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 lg:max-w-7xl lg:px-8">
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Block className="h-44" />
          <Block className="p-4">
            <div className="mb-4 flex gap-2">
              <Line className="h-10 w-36 rounded-lg" />
              <Line className="h-10 w-36 rounded-lg" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Line key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          </Block>
        </div>
        <div className="hidden space-y-4 lg:block">
          <Block className="h-56" />
          <Block className="h-36" />
        </div>
      </div>
    </main>
  );
}
