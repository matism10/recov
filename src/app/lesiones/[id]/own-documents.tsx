"use client";

// Documentos de la lesión vistos por el propio jugador: puede reemplazarlos,
// eliminarlos o agregar uno mientras el kine no revisa la lesión. Después, los
// botones quedan deshabilitados.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, MAX_FILES } from "@/lib/injuries";
import { ACCEPT, AttachmentLabel, fileProblem, uploadMedicalFiles } from "@/app/registrar-lesion/attachment-picker";
import { buttonSecondary, textButton } from "@/app/ui";
import { addOwnDocument, deleteOwnDocument, replaceOwnDocument } from "./document-actions";

export type OwnDocument = {
  id: string;
  file_name: string;
  created_at: string;
  status: string;
  url: string | null;
};

export function OwnDocuments({
  injuryId,
  clubId,
  playerId,
  documents,
  editable,
}: {
  injuryId: string;
  clubId: string;
  playerId: string;
  documents: OwnDocument[];
  editable: boolean; // lesión activa y sin revisar
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null); // documento que se reemplaza; null = agregar
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // La base puede bloquearla entre que se cargó la página y el click.
  const [lockedByServer, setLocked] = useState(false);
  const locked = lockedByServer || !editable;

  function run(action: () => Promise<{ error?: string; locked?: boolean }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.locked) setLocked(true);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  function pick(documentId: string | null) {
    target.current = documentId;
    inputRef.current?.click();
  }

  function onPicked(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    const problem = fileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    const documentId = target.current;
    run(async () => {
      const uploaded = await uploadMedicalFiles(createClient(), [file], clubId, playerId);
      if ("error" in uploaded) return uploaded;
      const [newFile] = uploaded.files;
      return documentId
        ? replaceOwnDocument(injuryId, documentId, newFile)
        : addOwnDocument(injuryId, newFile);
    });
  }

  const canEdit = !locked && !pending;

  return (
    <div className="space-y-3">
      <AttachmentLabel id="documentos-info" />
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => onPicked(e.target.files?.[0])}
      />

      {documents.length > 0 ? (
        <ul className="space-y-2">
          {documents.map((d) => {
            const docLocked = !canEdit || d.status !== "borrador";
            return (
              <li key={d.id} className="space-y-1 rounded-xl bg-mist px-5 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{d.file_name}</p>
                    <p className="text-sm text-muted">Subido el {formatDate(d.created_at)}</p>
                  </div>
                  {d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-text underline"
                    >
                      Ver
                    </a>
                  ) : (
                    <span className="text-sm text-muted">No disponible</span>
                  )}
                </div>
                <div className="flex gap-5">
                  <button type="button" disabled={docLocked} onClick={() => pick(d.id)} className={textButton}>
                    Reemplazar
                  </button>
                  <button
                    type="button"
                    disabled={docLocked}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar "${d.file_name}"?`)) {
                        run(() => deleteOwnDocument(injuryId, d.id));
                      }
                    }}
                    className={textButton}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl bg-mist p-5 text-sm text-muted">No hay documentos adjuntos.</p>
      )}

      {!locked && documents.length < MAX_FILES && (
        <button type="button" disabled={pending} onClick={() => pick(null)} className={`w-full sm:w-auto ${buttonSecondary}`}>
          <Paperclip aria-hidden="true" className="size-4" />
          {pending ? "Guardando…" : documents.length === 0 ? "Adjuntar archivo" : "Adjuntar otro"}
        </button>
      )}

      {locked && documents.length > 0 && (
        <p className="text-sm text-muted">
          El kinesiólogo ya revisó tu lesión, así que sus documentos ya no se pueden cambiar.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
