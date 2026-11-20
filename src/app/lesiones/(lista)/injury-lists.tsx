"use client";

// Lista de lesiones actuales con filtros que cambian en el cliente (sin volver al
// servidor). Los textos y fechas llegan ya armados desde la página para no depender
// de la hora del navegador.
import { useState } from "react";
import { AvailabilityBadge, StatusBadge } from "@/app/ui";
import { PlayerCard, PlayerCardList } from "@/app/ui-blocks";
import type { Availability } from "@/lib/roles";

export type CurrentItem = {
  id: string;
  name: string;
  photoUrl: string | null;
  group: "revisar" | "recuperacion";
  secondary: string;
  noDocument: boolean;
  progress?: number;
  availability: Availability;
  // Solo en "Por revisar": qué falta.
  reviewBadge?: string;
};

type Filter = "todas" | "revisar" | "lesionado" | "reintegro";

const matches = (i: CurrentItem, f: Filter) =>
  f === "todas" ||
  (f === "revisar" && i.group === "revisar") ||
  (f === "lesionado" && i.group === "recuperacion" && i.availability === "lesionado") ||
  (f === "reintegro" && i.group === "recuperacion" && i.availability === "reintegro");

export function CurrentInjuries({
  items,
  showPlayer,
  withFilters,
}: {
  items: CurrentItem[];
  showPlayer: boolean;
  withFilters: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("todas");
  const count = (f: Filter) => items.filter((i) => matches(i, f)).length;
  const chips: { id: Filter; label: string }[] = [
    { id: "todas", label: "Todas" },
    { id: "revisar", label: "Por revisar" },
    { id: "lesionado", label: "Lesionados" },
    { id: "reintegro", label: "Reintegro" },
  ];
  const visible = items.filter((i) => matches(i, filter));
  const groups = [
    { id: "revisar", label: "POR REVISAR", items: visible.filter((i) => i.group === "revisar") },
    { id: "recuperacion", label: "EN RECUPERACIÓN", items: visible.filter((i) => i.group === "recuperacion") },
  ].filter((g) => g.items.length > 0);

  return (
    <div>
      {withFilters && (
        <div role="group" aria-label="Filtrar lesiones" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
          {chips
            .filter((c) => c.id === "todas" || count(c.id) > 0)
            .map((c) => {
              const active = filter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(c.id)}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand-strong ${
                    active ? "border-brand-strong bg-brand-soft text-brand-text" : "border-line bg-card text-ink hover:bg-mist"
                  }`}
                >
                  {c.id === "todas" ? c.label : `${c.label} · ${count(c.id)}`}
                </button>
              );
            })}
        </div>
      )}
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.id} aria-label={g.label}>
            {withFilters && (
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted">
                {g.label} · {g.items.length}
              </h2>
            )}
            <PlayerCardList className="lg:grid lg:grid-cols-2">
              {g.items.map((i) => (
                <PlayerCard
                  key={i.id}
                  href={`/lesiones/${i.id}`}
                  name={i.name}
                  photoUrl={i.photoUrl}
                  showAvatar={showPlayer}
                  secondary={
                    <>
                      {i.secondary}
                      {i.noDocument && <span className="font-medium text-revision-fg"> · sin documento</span>}
                    </>
                  }
                  progress={i.progress}
                  progressLabel="Avance hacia el alta"
                  badge={
                    i.reviewBadge ? (
                      <StatusBadge className="bg-revision-bg text-revision-fg">{i.reviewBadge}</StatusBadge>
                    ) : (
                      <AvailabilityBadge status={i.availability} />
                    )
                  }
                />
              ))}
            </PlayerCardList>
          </section>
        ))}
      </div>
    </div>
  );
}
