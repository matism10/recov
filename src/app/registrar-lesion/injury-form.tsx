"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DESCRIPTION_MAX,
  DURATION_MAX,
  MAX_FILES,
  MAX_INJURY_AGE_DAYS,
  addDays,
  todayInChile,
  OCCURRED_DURING,
  OCCURRED_DURING_LABEL,
} from "@/lib/injuries";
import {
  BODY_ZONES,
  BODY_ZONE_KEYS,
  LATERALITIES,
  LATERALITY_LABEL,
  isBodyZone,
  isCentralZone,
  suggestLaterality,
  type BodyView,
  type BodyZone,
  type Laterality,
  type ScreenSide,
} from "@/lib/body-zones";
import { completeInjuryReport } from "@/app/lesiones/[id]/completar/actions";
import { BodyMap } from "@/app/body-map";
import { reportInjury, type ReportInjuryState } from "./actions";
import { AttachmentPicker, uploadMedicalFiles } from "./attachment-picker";
import { ErrorMessage, buttonPrimary, fieldClass, inputClass, labelClass, optionalClass } from "@/app/ui";

const optional = <span className={optionalClass}>(opcional)</span>;

const VIEWS: { value: BodyView; label: string }[] = [
  { value: "frente", label: "Frente" },
  { value: "espalda", label: "Espalda" },
];

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
  // reenvía, no se vuelven a subir.
  const uploaded = useRef(new Map<string, string>());
  const today = todayInChile();

  const [zone, setZone] = useState<BodyZone | null>(null);
  const [laterality, setLaterality] = useState<Laterality | null>(null);
  // true mientras el lado es el que se sugirió al tocar el mapa.
  const [suggested, setSuggested] = useState(false);
  const [view, setView] = useState<BodyView>("frente"); // celular: una vista a la vez
  const [files, setFiles] = useState<File[]>([]);

  function pickFromMap(z: BodyZone, side: ScreenSide, v: BodyView) {
    setZone(z);
    setLaterality(suggestLaterality(z, v, side));
    setSuggested(true);
  }

  function pickFromList(value: string) {
    if (!isBodyZone(value)) {
      setZone(null);
      return;
    }
    setZone(value);
    setSuggested(false);
    if (isCentralZone(value)) setLaterality("no_aplica");
    else if (laterality === "no_aplica") setLaterality(null);
  }

  const [state, formAction, pending] = useActionState<ReportInjuryState, FormData>(
    async (prevState, formData) => {
      if (!zone) return { error: "Elige la zona del cuerpo en el mapa o en la lista." };
      if (!laterality) return { error: "Indica el lado de la lesión." };

      const result = await uploadMedicalFiles(createClient(), files, clubId, playerId, uploaded.current);
      if ("error" in result) return { error: result.error };

      formData.set("body_zone", zone);
      formData.set("laterality", laterality);
      formData.set("files", JSON.stringify(result.files));
      const response = injuryId
        ? await completeInjuryReport(prevState, formData)
        : await reportInjury(prevState, formData);
      if (response.injuryId) router.push(`/lesiones/${response.injuryId}`);
      return response;
    },
    {},
  );

  const selected = zone && laterality ? { zone, laterality } : zone ? { zone, laterality: "bilateral" as const } : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10"
    >
      {/* Columna del mapa. Escritorio: Frente y Espalda lado a lado. Celular: un
          cuerpo con cambio Frente/Espalda y la lista debajo. */}
      <fieldset className="min-w-0 space-y-4">
        <legend className={labelClass}>Zona del cuerpo</legend>
        <p className="mt-1 text-sm text-muted">Toca dónde está la lesión. Una zona por lesión.</p>

        <div role="group" aria-label="Vista del cuerpo" className="flex rounded-xl border border-line bg-white p-1 lg:hidden">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              aria-pressed={view === v.value}
              onClick={() => setView(v.value)}
              className={`min-h-11 flex-1 rounded-lg text-sm font-medium transition ${
                view === v.value ? "bg-brand-soft text-brand-text" : "text-muted hover:text-ink"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {VIEWS.map((v) => (
            <figure key={v.value} className={view === v.value ? "" : "hidden lg:block"}>
              <BodyMap
                view={v.value}
                selected={selected}
                onPick={(z, side) => pickFromMap(z, side, v.value)}
                className="mx-auto max-w-[300px] lg:max-w-none"
              />
              <figcaption className="mt-1 text-center text-xs font-medium tracking-wide text-muted uppercase">
                {v.label}
              </figcaption>
            </figure>
          ))}
        </div>

        <label className={labelClass}>
          O elígela de la lista
          <select
            value={zone ?? ""}
            onChange={(e) => pickFromList(e.target.value)}
            className={inputClass}
          >
            <option value="">Elige una zona…</option>
            {BODY_ZONE_KEYS.map((z) => (
              <option key={z} value={z}>
                {BODY_ZONES[z].label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <div className="min-w-0 space-y-4">
        <fieldset>
          <legend className={labelClass}>Lado</legend>
          <div role="radiogroup" aria-label="Lado de la lesión" className="mt-2 flex flex-wrap gap-2">
            {LATERALITIES.map((l) => {
              const checked = laterality === l;
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => {
                    setLaterality(l);
                    setSuggested(false);
                  }}
                  className={`min-h-11 rounded-full border px-4 text-sm font-medium transition ${
                    checked
                      ? "border-brand-strong bg-brand-soft text-brand-text"
                      : "border-line bg-white text-ink hover:bg-mist"
                  }`}
                >
                  {LATERALITY_LABEL[l]}
                </button>
              );
            })}
          </div>
          {suggested && laterality && (
            <p className="mt-2 text-sm text-muted">Sugerido según el lado que tocaste. Puedes cambiarlo.</p>
          )}
        </fieldset>

        <label className={labelClass}>
          Detalle {optional}
          <textarea
            name="description"
            rows={3}
            maxLength={DESCRIPTION_MAX}
            placeholder="Cómo ocurrió, qué sientes o qué te dijo el médico"
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

        <AttachmentPicker files={files} onChange={setFiles} max={MAX_FILES} />

        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}

        <button type="submit" disabled={pending} className={`w-full ${buttonPrimary}`}>
          {pending ? "Enviando…" : injuryId ? "Envía tu diagnóstico" : "Registra tu lesión"}
        </button>
      </div>
    </form>
  );
}

