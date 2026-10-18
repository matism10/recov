"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { resizeCover } from "@/app/avatar-resize";
import { ErrorMessage, SuccessMessage, textButton } from "@/app/ui";
import { setClubCover, type CoverState } from "./actions";

// Portada: se achica en el navegador, se sube directo a Storage (carpeta del club,
// bucket privado) y set_club_cover la deja en el club.
export function CoverForm({
  clubName,
  url,
  folder,
}: {
  clubName: string;
  url: string | null;
  folder: string;
}) {
  const [preview, setPreview] = useState<string | null>(url);
  const [state, setState] = useState<CoverState>({});
  const [pending, startTransition] = useTransition();

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    startTransition(async () => {
      setState({});
      let blob: Blob;
      try {
        blob = await resizeCover(file);
      } catch {
        setState({ error: "No pudimos leer esa imagen. Prueba con un JPG o PNG." });
        return;
      }
      const path = `${folder}/${crypto.randomUUID()}.jpg`;
      const { error } = await createClient()
        .storage.from("club-covers")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) {
        setState({ error: "No se pudo subir la portada. Intenta de nuevo." });
        return;
      }
      const result = await setClubCover(path);
      if (result.ok) setPreview(URL.createObjectURL(blob));
      setState(result);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await setClubCover(null);
      if (result.ok) setPreview(null);
      setState(result);
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative h-24 w-full overflow-hidden rounded-xl border border-line bg-surface-2 lg:h-32">
        {preview ? (
          // Vista previa (URL firmada o local): no pasa por next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={`Portada de ${clubName}`}
            className="h-full w-full object-cover object-[50%_22%]"
          />
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-muted">Sin portada</p>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4">
        <label className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand-text underline">
          {preview ? "Cambia la portada" : "Sube una portada"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={pick}
            disabled={pending}
            className="sr-only"
          />
        </label>
        {preview && (
          <button type="button" onClick={remove} disabled={pending} className={textButton}>
            Quita la portada
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        JPG, PNG o WebP, idealmente horizontal. Se ajusta a 1600 px. La ven solo los
        miembros confirmados del club.
      </p>
      {pending && <p className="text-sm text-muted">Guardando…</p>}
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && !pending && <SuccessMessage>Portada guardada.</SuccessMessage>}
    </div>
  );
}
