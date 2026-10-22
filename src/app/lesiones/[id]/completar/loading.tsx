// Esqueleto de "Sube tu diagnóstico": formulario con documentos.
import { FormSkeleton } from "@/app/skeleton";

export default function Loading() {
  return <FormSkeleton label="el formulario del diagnóstico" fields={3} tallField />;
}
