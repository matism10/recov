// Esqueleto de "Marcar lesionado": formulario breve.
import { FormSkeleton } from "@/app/skeleton";

export default function Loading() {
  return <FormSkeleton label="el formulario para marcar la lesión" fields={3} />;
}
