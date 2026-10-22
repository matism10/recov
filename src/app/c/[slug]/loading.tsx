// Esqueleto del link de registro del club: la tarjeta con el nombre y las opciones.
import { Block, Line } from "@/app/skeleton";

export default function Loading() {
  return (
    <main aria-busy="true" className="flex flex-1 items-center justify-center bg-white px-4 py-10">
      <p role="status" className="sr-only">
        Cargando el registro del club…
      </p>
      <Block className="w-full max-w-md space-y-4 p-8">
        <Line className="h-4 w-16" />
        <Line className="h-8 w-48" />
        <Line className="h-4 w-56 max-w-full" />
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Line className="h-11 rounded-xl" />
          <Line className="h-11 rounded-xl" />
        </div>
      </Block>
    </main>
  );
}
