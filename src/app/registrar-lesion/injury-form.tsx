"use client";

import { startTransition, useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DESCRIPTION_MAX,
  DURATION_MAX,
  FILE_NAME_MAX,
  FILE_TYPES,
  INJURY_TYPE_MAX,
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_INJURY_AGE_DAYS,
  MIN_FILES,
  addDays,
  todayInChile,
  OCCURRED_DURING,
  OCCURRED_DURING_LABEL,
} from "@/lib/injuries";
import { completeInjuryReport } from "@/app/lesiones/[id]/completar/actions";
import { reportInjury, type ReportInjuryState } from "./actions";
import { ErrorMessage, buttonPrimary, fieldClass, inputClass, labelClass, optionalClass } from "@/app/ui";

const optional = <span className={optionalClass}>(opcional)</span>;

const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

// Sin injuryId registra una lesión nueva (report_injury). Con injuryId completa
// el diagnóstico de una lesión en evaluación (complete_injury_report): la fecha
// ya la tiene la lesión, así que no se pide.
export function InjuryForm({
  clubId,
  playerId,
  injuryId,
}: {
  clubId: string;
  playerId: string;
  injuryId?: string;
}) {
  const router = useRouter();
  // Archivos ya subidos en un intento anterior: si el registro falla y se
  // reenvía, no se vuelven a subir (el jugador no puede borrar del bucket).
  const uploaded = useRef(new Map<string, string>());
  const today = todayInChile();

  const [state, formAction, pending] = useActionState<ReportInjuryState, FormData>(
    async (prevState, formData) => {
      const files = formData
        .getAll("files")
        .filter((f): f is File => f instanceof File && f.size > 0);

      if (files.length < MIN_FILES || files.length > MAX_FILES) {
        return { error: `Adjunta entre ${MIN_FILES} y ${MAX_FILES} documentos.` };
      }
      for (const f of files) {
        if (!FILE_TYPES[f.type]) return { error: `"${f.name}" no es PDF, JPG ni PNG.` };
        if (f.size > MAX_FILE_BYTES) return { error: `"${f.name}" pesa más de 10 MB.` };
      }

      const supabase = createClient();
      const results = await Promise.all(
        files.map(async (f) => {
          const name = f.name.slice(0, FILE_NAME_MAX);
          const cached = uploaded.current.get(fileKey(f));
          if (cached) return { path: cached, name };

          const path = `${clubId}/${playerId}/${crypto.randomUUID()}.${FILE_TYPES[f.type]}`;
          const { error } = await supabase.storage
            .from("medical-docs")
            .upload(path, f, { contentType: f.type, upsert: false });
          if (error) return { error: `No se pudo subir "${f.name}". Intenta de nuevo.` };

          uploaded.current.set(fileKey(f), path);
          return { path, name };
        }),
      );

      const failed = results.find((r) => "error" in r);
      if (failed && "error" in failed) return { error: failed.error };

      formData.delete("files");
      formData.set("files", JSON.stringify(results));
      const result = injuryId
        ? await completeInjuryReport(prevState, formData)
        : await reportInjury(prevState, formData);
      if (result.injuryId) router.push(`/lesiones/${result.injuryId}`);
      return result;
    },
    {},
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-4"
    >
      <label className={labelClass}>
        Tipo de lesión
        <input
          name="type"
          required
          minLength={2}
          maxLength={INJURY_TYPE_MAX}
          placeholder="Ej.: Esguince de tobillo"
          className={inputClass}
        />
      </label>

      {injuryId ? (
        <input type="hidden" name="injury_id" value={injuryId} />
      ) : (
        <>
          <label className={labelClass}>
            Fecha en que ocurrió
            <input
              name="injury_date"
              type="date"
              required
              max={today}
              min={addDays(today, -MAX_INJURY_AGE_DAYS)}
              className={inputClass}
            />
          </label>

          {/* Obligatorio y sin opción preseleccionada (report_injury, 0018). */}
          <fieldset>
            <legend className={labelClass}>¿Dónde ocurrió?</legend>
            <div className="mt-2 flex flex-wrap gap-x-6">
              {OCCURRED_DURING.map((value) => (
                <label key={value} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="occurred_during"
                    value={value}
                    required
                    className="size-4 accent-brand-strong"
                  />
                  {OCCURRED_DURING_LABEL[value]}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <fieldset>
        <legend className={labelClass}>Duración que te indicó el médico</legend>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <input
            name="duration_value"
            type="number"
            required
            min={1}
            max={DURATION_MAX.semanas}
            step={1}
            aria-label="Cantidad"
            className={fieldClass}
          />
          <select
            name="duration_unit"
            defaultValue="semanas"
            aria-label="Unidad"
            className={fieldClass}
          >
            <option value="semanas">Semanas</option>
            <option value="meses">Meses</option>
          </select>
        </div>
      </fieldset>

      <label className={labelClass}>
        Descripción {optional}
        <textarea
          name="description"
          rows={3}
          maxLength={DESCRIPTION_MAX}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Documentos médicos
        <span className="block font-normal text-muted">
          De {MIN_FILES} a {MAX_FILES} archivos PDF, JPG o PNG, máximo 10 MB cada uno.
        </span>
        <input
          name="files"
          type="file"
          required
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="mt-2 block w-full text-sm text-muted file:mr-3 file:min-h-11 file:rounded-xl file:border file:border-line file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-mist"
        />
      </label>

      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <button
        type="submit"
        disabled={pending}
        className={`w-full ${buttonPrimary}`}
      >
        {pending ? "Enviando…" : injuryId ? "Envía tu diagnóstico" : "Registra tu lesión"}
      </button>
    </form>
  );
}
