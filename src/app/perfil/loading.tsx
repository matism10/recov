// Esqueleto del Perfil: foto, datos, contacto y cuenta.
import { BackSkeleton, Block, Circle, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="tu perfil" width="narrow">
      <BackSkeleton />
      <TitleSkeleton subtitle />
      <div className="space-y-6">
        <Block className="flex items-center gap-4 p-5">
          <Circle className="size-16" />
          <Line className="h-11 w-36 rounded-xl" />
        </Block>
        <Block className="h-72" />
        <Block className="h-32" />
        <Block className="h-48" />
      </div>
    </PageSkeleton>
  );
}
