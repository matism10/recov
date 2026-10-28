"use client";

import { useState, useTransition } from "react";
import { ErrorMessage, SectionTitle, SuccessMessage, buttonPrimary, cardClass } from "@/app/ui";
import { setSevensGroup } from "@/app/sevens-actions";

export type GroupCandidate = { id: string; name: string; player: boolean; roleLabel: string };

// Casillas por persona (jugadores y staff), contador y "Guardar grupo". Se guarda la
// lista completa.
export function SevensGroupForm({ candidates, selected }: { candidates: GroupCandidate[]; selected: string[] }) {
  const [chosen, setChosen] = useState(() => new Set(selected));
  const [result, setResult] = useState<{ ok?: boolean; error?: string }>({});
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => {
    setResult({});
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = () =>
    startTransition(async () => {
      setResult(await setSevensGroup([...chosen]));
    });

  const groups = [
    { title: "Jugadores", items: candidates.filter((c) => c.player) },
    { title: "Staff", items: candidates.filter((c) => !c.player) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.title}>
          <SectionTitle className="mb-3">{g.title}</SectionTitle>
          <ul className={`divide-y divide-line overflow-hidden ${cardClass}`}>
            {g.items.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 transition hover:bg-white">
                  <input
                    type="checkbox"
                    checked={chosen.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="size-5 shrink-0 accent-brand-strong"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium break-words text-ink">{c.name}</span>
                    {c.roleLabel && <span className="block text-sm text-muted">{c.roleLabel}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {/* Barra pegada abajo (sobre la barra de navegación del celular), como en Evaluaciones. */}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 rounded-xl border border-line bg-white p-3 shadow-sm lg:bottom-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-ink">
            {chosen.size === 1 ? "1 seleccionado" : `${chosen.size} seleccionados`}
          </p>
          <button type="button" onClick={save} disabled={pending} className={buttonPrimary}>
            {pending ? "Guardando…" : "Guardar grupo"}
          </button>
        </div>
        {result.error && <ErrorMessage className="mt-2">{result.error}</ErrorMessage>}
        {result.ok && !pending && (
          <div className="mt-2">
            <SuccessMessage>Grupo guardado.</SuccessMessage>
          </div>
        )}
      </div>
    </div>
  );
}
