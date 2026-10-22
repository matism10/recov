// Esqueleto de Configuración: logo, portada, métricas del Resumen y partidos.
import { Block, Line, PageSkeleton, TitleSkeleton } from "@/app/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="la configuración" width="medium">
      <TitleSkeleton subtitle />
      <div className="space-y-6">
        {["h-28", "h-56", "h-48", "h-36"].map((h, i) => (
          <Block key={i} className={`space-y-3 p-5 ${h}`}>
            <Line className="h-5 w-40" />
            <Line className="h-4 w-64 max-w-full" />
          </Block>
        ))}
      </div>
    </PageSkeleton>
  );
}
