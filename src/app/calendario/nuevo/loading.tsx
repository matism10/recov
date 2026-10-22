// Esqueleto de nuevo evento: formulario.
import { FormSkeleton } from "@/app/skeleton";

export default function Loading() {
  return <FormSkeleton label="el formulario del evento" fields={5} />;
}
