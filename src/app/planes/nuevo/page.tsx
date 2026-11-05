import { notFound } from "next/navigation";
import { loadEditorData } from "../editor-data";
import { PlanEditor } from "../plan-editor";

// Nuevo plan de gimnasio (head coach y preparador físico).
export default async function NewPlanPage() {
  const data = await loadEditorData(null);
  if (!data) notFound();
  return <PlanEditor data={data} saved={null} />;
}
