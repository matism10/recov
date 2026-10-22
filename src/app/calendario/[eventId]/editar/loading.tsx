// Esqueleto de editar un evento: formulario.
import { FormSkeleton } from "@/app/skeleton";

export default function Loading() {
  return <FormSkeleton label="el evento" fields={5} />;
}
