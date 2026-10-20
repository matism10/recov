"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { LoadScaleRow, NominaMode } from "@/lib/match-load";
import { ErrorMessage, SuccessMessage, buttonPrimary, fieldClass, textButton } from "@/app/ui";
import { saveParticipation, type ParticipationRow, type ParticipationState } from "./actions";

export type ParticipationEntry = {
  playerId: string;
  name: string;
  position: string | null;
  minutes: number | null;
  bucket: number | null;
  played: boolean | null;
  loaded: boolean;
  otherMode: boolean; // cargado en otro modo
};

type Draft = { minutes: string; bucket: number | null; played: boolean | null };

const chipClass = (active: boolean) =>
  `inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border px-3 text-sm font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-strong ${
    active ? "border-brand-strong bg-brand-soft text-brand-text" : "border-line bg-white text-ink hover:bg-mist"
  }`;

// Lista de convocados con el control según el modo del club. Las filas sin dato
// no se envían; lo que se envía se guarda todo junto (todo o nada).
export function ParticipationForm({
  eventId,
  mode,
  maxMinutes,
  scale,
  entries,
  callupsHref,
}: {
  eventId: string;
  mode: NominaMode;
  maxMinutes: number;
  scale: LoadScaleRow[];
  entries: ParticipationEntry[];
  callupsHref: string;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      entries.map((e) => [
        e.playerId,
        {
          minutes: e.minutes !== null ? String(e.minutes) : "",
          bucket: e.bucket,
          played: e.played,
        },
      ]),
    ),
  );
  const [state, setState] = useState<ParticipationState>({});
  const [pending, startTransition] = useTransition();

  const update = (id: string, patch: Partial<Draft>) => {
    setState({});
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  };

  // Filas con dato para el modo actual y errores de los minutos.
  const rows: ParticipationRow[] = [];
  const invalid: string[] = [];
  for (const e of entries) {
    const d = drafts[e.playerId];
    if (mode === "exacto") {
      if (d.minutes.trim() === "") continue;
      const n = Number(d.minutes);
      if (!Number.isInteger(n) || n < 0 || n > maxMinutes) invalid.push(e.name);
      else rows.push({ player_id: e.playerId, minutes: n });
    } else if (mode === "rango") {
      if (d.bucket !== null) rows.push({ player_id: e.playerId, range_bucket: d.bucket });
    } else if (d.played !== null) {
      rows.push({ player_id: e.playerId, played: d.played });
    }
  }
  const missing = entries.length - rows.length - invalid.length;
  const otherMode = entries.filter((e) => e.otherMode).length;

  function save() {
    if (invalid.length > 0) {
      setState({ error: `Revisa los minutos de ${invalid.join(", ")} (entre 0 y ${maxMinutes}).` });
      return;
    }
    if (rows.length === 0) {
      setState({ error: "Carga al menos un jugador." });
      return;
    }
    startTransition(async () => setState(await saveParticipation(eventId, mode, rows)));
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        {mode === "exacto"
          ? `Anota los minutos jugados (0 a ${maxMinutes}). 0 = no jugó.`
          : mode === "rango"
            ? "Elige el rango de minutos que jugó cada convocado."
            : "Marca si cada convocado jugó o no."}{" "}
        <Link href={callupsHref} className="font-medium text-brand-text underline">
          Edita la convocatoria
        </Link>
      </p>
      {otherMode > 0 && (
        <p className="rounded-xl bg-revision-bg p-3 text-sm text-revision-fg">
          {otherMode === 1 ? "1 convocado tiene" : `${otherMode} convocados tienen`} datos cargados en
          otro modo. Si los guardas de nuevo, quedan en el modo actual.
        </p>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-mist">
        {entries.map((e) => {
          const d = drafts[e.playerId];
          const inputId = `min-${e.playerId}`;
          return (
            <li key={e.playerId} className="space-y-2 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
              <div className="min-w-0">
                {mode === "exacto" ? (
                  <label htmlFor={inputId} className="block truncate font-medium text-ink">
                    {e.name}
                  </label>
                ) : (
                  <p id={`name-${e.playerId}`} className="truncate font-medium text-ink">
                    {e.name}
                  </p>
                )}
                {e.position && <p className="text-xs text-muted">{e.position}</p>}
              </div>

              {mode === "exacto" && (
                <div className="flex items-center gap-2">
                  <input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={maxMinutes}
                    step={1}
                    value={d.minutes}
                    onChange={(ev) => update(e.playerId, { minutes: ev.target.value })}
                    disabled={pending}
                    placeholder="—"
                    className={`${fieldClass} w-24 text-right tabular-nums`}
                  />
                  <span className="text-sm text-muted">min</span>
                </div>
              )}

              {mode === "rango" && (
                <div
                  role="radiogroup"
                  aria-labelledby={`name-${e.playerId}`}
                  className="flex flex-wrap gap-1.5"
                >
                  {scale.map((s) => (
                    <label key={s.bucket} className={chipClass(d.bucket === s.bucket)}>
                      <input
                        type="radio"
                        name={`bucket-${e.playerId}`}
                        checked={d.bucket === s.bucket}
                        onChange={() => update(e.playerId, { bucket: s.bucket })}
                        disabled={pending}
                        className="sr-only"
                      />
                      {s.bucket === 0 ? "No jugó" : s.label}
                    </label>
                  ))}
                </div>
              )}

              {mode === "jugo" && (
                <div role="radiogroup" aria-labelledby={`name-${e.playerId}`} className="flex gap-1.5">
                  {[
                    { value: true, label: "Jugó" },
                    { value: false, label: "No jugó" },
                  ].map((o) => (
                    <label key={o.label} className={chipClass(d.played === o.value)}>
                      <input
                        type="radio"
                        name={`played-${e.playerId}`}
                        checked={d.played === o.value}
                        onChange={() => update(e.playerId, { played: o.value })}
                        disabled={pending}
                        className="sr-only"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={pending} className={buttonPrimary}>
            {pending ? "Guardando…" : "Guarda la participación"}
          </button>
          {mode === "rango" && (
            <button
              type="button"
              onClick={() =>
                setDrafts((ds) =>
                  Object.fromEntries(
                    Object.entries(ds).map(([id, d]) => [id, { ...d, bucket: d.bucket ?? 0 }]),
                  ),
                )
              }
              disabled={pending}
              className={textButton}
            >
              Marca “No jugó” en los vacíos
            </button>
          )}
        </div>
        {missing > 0 && (
          <p className="text-sm text-muted">
            {missing === 1 ? "1 convocado queda" : `${missing} convocados quedan`} sin cargar.
          </p>
        )}
        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
        {state.ok && !pending && <SuccessMessage>Participación guardada.</SuccessMessage>}
      </div>
    </div>
  );
}
