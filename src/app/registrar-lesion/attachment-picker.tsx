"use client";

// Adjunto médico opcional del registro de lesión: elegir, reemplazar o eliminar
// archivos antes de enviar. Los archivos se suben a Storage recién al enviar
// (uploadMedicalFiles), en la carpeta del jugador.
import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Paperclip } from "lucide-react";
import { FILE_NAME_MAX, FILE_TYPES, MAX_FILE_BYTES } from "@/lib/injuries";
import { InfoPopover } from "@/app/info-popover";
import { buttonSecondary, labelClass, optionalClass, textButton } from "@/app/ui";

export const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const ATTACHMENT_HELP =
  "Si tienes orden médica o examen, te recomendamos subirlo: ayuda al kine a evaluar mejor tu lesión. Si no tienes, puedes continuar sin documento.";

const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

// null si el archivo sirve; si no, el motivo.
export function fileProblem(f: File) {
  if (!FILE_TYPES[f.type]) return `"${f.name}" no es PDF, JPG ni PNG.`;
  if (f.size > MAX_FILE_BYTES) return `"${f.name}" pesa más de 10 MB.`;
  return null;
}

export function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Sube los archivos a medical-docs/{club}/{jugador}/{uuid}.{ext}. `cache` evita
// volver a subir los de un intento anterior que falló.
export async function uploadMedicalFiles(
  supabase: SupabaseClient,
  files: File[],
  clubId: string,
  playerId: string,
  cache?: Map<string, string>,
): Promise<{ files: { path: string; name: string }[] } | { error: string }> {
  for (const f of files) {
    const problem = fileProblem(f);
    if (problem) return { error: problem };
  }
  type Result = { path: string; name: string } | { error: string };
  const results = await Promise.all(
    files.map(async (f): Promise<Result> => {
      const name = f.name.slice(0, FILE_NAME_MAX);
      const cached = cache?.get(fileKey(f));
      if (cached) return { path: cached, name };
      const path = `${clubId}/${playerId}/${crypto.randomUUID()}.${FILE_TYPES[f.type]}`;
      const { error } = await supabase.storage
        .from("medical-docs")
        .upload(path, f, { contentType: f.type, upsert: false });
      if (error) return { error: `No se pudo subir "${f.name}". Intenta de nuevo.` };
      cache?.set(fileKey(f), path);
      return { path, name };
    }),
  );
  const uploaded: { path: string; name: string }[] = [];
  for (const r of results) {
    if ("error" in r) return { error: r.error };
    uploaded.push(r);
  }
  return { files: uploaded };
}

// Etiqueta "Orden médica o examen (opcional)" con el botón de información.
export function AttachmentLabel({ id }: { id: string }) {
  return (
    <div className="relative flex items-center gap-1">
      <span className={labelClass}>
        Orden médica o examen <span className={optionalClass}>(opcional)</span>
      </span>
      <InfoPopover id={id} label="Por qué subir una orden médica o examen">
        {ATTACHMENT_HELP}
      </InfoPopover>
    </div>
  );
}

export function AttachmentPicker({
  files,
  onChange,
  max,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Índice del archivo que se reemplaza; null = agregar.
  const replacing = useRef<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  function open(index: number | null) {
    replacing.current = index;
    inputRef.current?.click();
  }

  function onPicked(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (picked.length === 0) return;
    const bad = picked.map(fileProblem).find(Boolean);
    if (bad) {
      setProblem(bad);
      return;
    }
    setProblem(null);
    const index = replacing.current;
    if (index !== null) {
      onChange(files.map((f, i) => (i === index ? picked[0] : f)));
    } else {
      onChange([...files, ...picked].slice(0, max));
    }
  }

  return (
    <div className="space-y-2">
      <AttachmentLabel id="adjunto-info" />
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => onPicked(e.target.files)}
      />
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${f.lastModified}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-white px-4 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{f.name}</p>
                <p className="text-xs text-muted">{formatSize(f.size)}</p>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => open(i)} className={textButton}>
                  Reemplazar
                </button>
                <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className={textButton}>
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {files.length < max && (
        <button type="button" onClick={() => open(null)} className={`w-full sm:w-auto ${buttonSecondary}`}>
          <Paperclip aria-hidden="true" className="size-4" />
          {files.length === 0 ? "Adjuntar archivo" : "Adjuntar otro"}
        </button>
      )}
      <p className="text-xs text-muted">PDF, JPG o PNG, máximo 10 MB cada uno. Hasta {max} archivos.</p>
      {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
    </div>
  );
}
