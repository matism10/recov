"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { resizeLogo } from "@/app/avatar-resize";
import { ClubLogo } from "@/app/club-logo";
import { ErrorMessage, SuccessMessage, textButton } from "@/app/ui";
import { setClubLogo, type LogoState } from "./actions";

// Logo: se achica en el navegador, se sube directo a Storage (carpeta del club)
// y set_club_logo lo deja en el club.
export function LogoForm({
  clubName,
  url,
  folder,
}: {
  clubName: string;
  url: string | null;
  folder: string;
}) {
  const [preview, setPreview] = useState<string | null>(url);
  const [state, setState] = useState<LogoState>({});
  const [pending, startTransition] = useTransition();

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    startTransition(async () => {
      setState({});
      let blob: Blob;
      try {
        blob = await resizeLogo(file);
      } catch {
        setState({ error: "No pudimos leer esa imagen. Prueba con un PNG o JPG." });
        return;
      }
      const path = `${folder}/${crypto.randomUUID()}.png`;
      const { error } = await createClient()
        .storage.from("club-logos")
        .upload(path, blob, { contentType: "image/png", upsert: false });
      if (error) {
        setState({ error: "No se pudo subir el logo. Intenta de nuevo." });
        return;
      }
      const result = await setClubLogo(path);
      if (result.ok) setPreview(URL.createObjectURL(blob));
      setState(result);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await setClubLogo(null);
      if (result.ok) setPreview(null);
      setState(result);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <ClubLogo name={clubName} url={preview} size="lg" />
        <div className="flex flex-wrap gap-x-4">
          <label className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand-text underline">
            {preview ? "Cambia el logo" : "Sube un logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={pick}
              disabled={pending}
              className="sr-only"
            />
          </label>
          {preview && (
            <button type="button" onClick={remove} disabled={pending} className={textButton}>
              Quita el logo
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted">PNG, JPG o WebP. Se ajusta a 256 px.</p>
      {pending && <p className="text-sm text-muted">Guardando…</p>}
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && !pending && <SuccessMessage>Logo guardado.</SuccessMessage>}
    </div>
  );
}
