import { notFound } from "next/navigation";
import { loadEditorData } from "../editor-data";
import { PlanEditor } from "../plan-editor";

const OK_TEXT: Record<string, string> = {
  borrador: "Borrador guardado.",
  publicado: "Plan publicado: los jugadores ya lo ven.",
  guardado: "Cambios guardados.",
};

// Un plan de gimnasio: se edita aunque esté publicado (los registros ya hechos no
// cambian); archivado, solo se lee.
export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await loadEditorData(id);
  if (!data) notFound();
  const ok = typeof query.ok === "string" ? (OK_TEXT[query.ok] ?? null) : null;
  // key: al cambiar de plan, el editor parte con su propio estado.
  return <PlanEditor key={id} data={data} saved={ok} />;
}
