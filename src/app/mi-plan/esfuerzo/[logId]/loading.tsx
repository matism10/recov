import { Block, Line, PageSkeleton } from "@/app/skeleton";

// Esqueleto del esfuerzo del gimnasio: volver, título y la escala de 0 a 10.
export default function Loading() {
  return (
    <PageSkeleton label="la sesión" width="narrow">
      <Line className="mb-3 h-4 w-32" />
      <Line className="mb-2 h-3 w-56" />
      <Line className="mb-6 h-8 w-72 max-w-[85vw]" />
      <div className="space-y-1">
        {Array.from({ length: 11 }, (_, i) => (
          <Block key={i} className="h-11" />
        ))}
      </div>
    </PageSkeleton>
  );
}
