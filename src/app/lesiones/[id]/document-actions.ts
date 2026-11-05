"use server";

// El jugador quita, reemplaza o agrega documentos de su lesión mientras el kine no
// la revisa. La base decide (delete_own_draft_document, add_own_injury_document);
// el archivo se borra de Storage aquí, con la clave de servicio, porque el jugador
// no tiene DELETE sobre el bucket.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/session";
import { removeUnreferencedMedicalDoc } from "@/lib/supabase/admin";
import { filesInPlayerFolder, type UploadedFile } from "@/app/registrar-lesion/report-fields";

export type DocumentActionState = { error?: string; locked?: boolean };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCKED =
  "El kinesiólogo ya revisó tu lesión, así que sus documentos ya no se pueden cambiar.";

// Errores de la base en un mensaje amable. "ya revisó" = la lesión quedó bloqueada.
function friendly(error: { code?: string; message: string }, fallback: string): DocumentActionState {
  if (error.code === "P0001" && /ya revis/i.test(error.message)) return { error: LOCKED, locked: true };
  if (error.code === "P0001") return { error: error.message };
  return { error: fallback };
}

async function ownPlayer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, player: null };
  const { data: player } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("user_id", user.id)
    .eq("club_id", await getActiveClubId(user.id))
    .maybeSingle();
  return { supabase, player };
}

async function removeOwnDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
): Promise<DocumentActionState & { path?: string }> {
  const { data, error } = await supabase.rpc("delete_own_draft_document", { p_document_id: documentId });
  if (error) return friendly(error, "No se pudo eliminar el documento. Intenta de nuevo.");
  return { path: data as string };
}

export async function deleteOwnDocument(injuryId: string, documentId: string): Promise<DocumentActionState> {
  if (!UUID_RE.test(injuryId) || !UUID_RE.test(documentId)) return { error: "Documento no válido." };
  const { supabase, player } = await ownPlayer();
  if (!player) return { error: "Tu sesión expiró. Vuelve a ingresar." };

  const removed = await removeOwnDraft(supabase, documentId);
  if (removed.error) return removed;
  if (removed.path && filesInPlayerFolder([{ path: removed.path, name: "x" }], player.club_id, player.id)) {
    await removeUnreferencedMedicalDoc(removed.path);
  }
  revalidatePath(`/lesiones/${injuryId}`);
  return {};
}

// Agrega un archivo ya subido a la carpeta del jugador. Si la base lo rechaza, se
// borra de Storage para no dejarlo huérfano.
async function addUploaded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  injuryId: string,
  file: UploadedFile,
): Promise<DocumentActionState> {
  const { error } = await supabase.rpc("add_own_injury_document", {
    p_injury_id: injuryId,
    p_path: file.path,
    p_name: file.name,
  });
  if (error) {
    await removeUnreferencedMedicalDoc(file.path);
    return friendly(error, "No se pudo agregar el documento. Intenta de nuevo.");
  }
  return {};
}

export async function addOwnDocument(injuryId: string, file: UploadedFile): Promise<DocumentActionState> {
  if (!UUID_RE.test(injuryId)) return { error: "Lesión no válida." };
  const { supabase, player } = await ownPlayer();
  if (!player) return { error: "Tu sesión expiró. Vuelve a ingresar." };
  if (!filesInPlayerFolder([file], player.club_id, player.id)) {
    return { error: "El archivo no es válido. Vuelve a elegirlo." };
  }
  const result = await addUploaded(supabase, injuryId, file);
  revalidatePath(`/lesiones/${injuryId}`);
  return result;
}

// Reemplazar = eliminar el anterior + agregar el nuevo (ya subido a Storage).
export async function replaceOwnDocument(
  injuryId: string,
  documentId: string,
  file: UploadedFile,
): Promise<DocumentActionState> {
  if (!UUID_RE.test(injuryId) || !UUID_RE.test(documentId)) return { error: "Documento no válido." };
  const { supabase, player } = await ownPlayer();
  if (!player) return { error: "Tu sesión expiró. Vuelve a ingresar." };
  if (!filesInPlayerFolder([file], player.club_id, player.id)) {
    return { error: "El archivo no es válido. Vuelve a elegirlo." };
  }

  const removed = await removeOwnDraft(supabase, documentId);
  if (removed.error) {
    await removeUnreferencedMedicalDoc(file.path);
    return removed;
  }
  if (removed.path && filesInPlayerFolder([{ path: removed.path, name: "x" }], player.club_id, player.id)) {
    await removeUnreferencedMedicalDoc(removed.path);
  }

  const added = await addUploaded(supabase, injuryId, file);
  revalidatePath(`/lesiones/${injuryId}`);
  if (added.error && !added.locked) {
    return { error: `Se eliminó el documento anterior, pero no se pudo agregar el nuevo. ${added.error}` };
  }
  return added;
}
