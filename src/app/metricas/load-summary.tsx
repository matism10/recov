"use client";

// Resumen de la carga: cuántos con carga alta y cuántos sin minutos (o sin
// partidos en "jugó"). Cada tarjeta despliega la lista de esos jugadores con el
// mismo formato del ranking (barras, minutos y estado).
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TeamLoad } from "@/lib/match-load";
import { LoadRow } from "./load-row";

type Key = "alta" | "sin";

export function LoadSummary({ load }: { load: TeamLoad }) {
  const [open, setOpen] = useState<Key | null>(null);
  const n = load.matches_count;
  const ready = n >= 3; // con menos de 3 partidos no hay semáforo
  // Posición de cada jugador en el ranking completo (ya viene ordenado por carga).
  const rankOf = new Map(load.players.map((p, i) => [p.player_id, i + 1]));
  const lists: Record<Key, { label: string; title: string; players: TeamLoad["players"] }> = {
    alta: {
      label: "con carga alta",
      title: "Jugadores con carga alta",
      players: load.players.filter((p) => p.status === "alta"),
    },
    sin: {
      label:
        load.mode === "jugo"
          ? `sin partidos en los últimos ${n}`
          : `sin minutos en los últimos ${n} ${n === 1 ? "partido" : "partidos"}`,
      title: load.mode === "jugo" ? "Jugadores sin partidos" : "Jugadores sin minutos",
      players: load.players.filter((p) => p.status === "sin_minutos" || p.status === "sin_partidos"),
    },
  };
  const current = open ? lists[open] : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(lists) as Key[]).map((k) => {
          const l = lists[k];
          const canOpen = ready && l.players.length > 0;
          const expanded = open === k;
          return (
            <button
              key={k}
              type="button"
              disabled={!canOpen}
              aria-expanded={canOpen ? expanded : undefined}
              aria-controls={canOpen ? "load-summary-list" : undefined}
              onClick={() => setOpen(expanded ? null : k)}
              className={`flex flex-col items-start rounded-xl p-4 text-left transition ${
                expanded ? "bg-brand-soft ring-2 ring-brand-strong" : "bg-mist enabled:hover:bg-surface-2"
              }`}
            >
              <span className="font-display text-3xl font-bold text-ink tabular-nums">
                {ready ? l.players.length : "—"}
              </span>
              <span className="text-sm text-muted">{l.label}</span>
              {canOpen && (
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-text">
                  {expanded ? "Ocultar lista" : "Ver lista"}
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-4 transition ${expanded ? "rotate-180" : ""}`}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {current && (
        <div id="load-summary-list" className="rounded-xl border border-line px-4 pt-3 pb-1">
          <h3 className="font-medium text-ink">
            {current.title} ({current.players.length})
          </h3>
          <ol className="divide-y divide-line">
            {current.players.map((p) => (
              <LoadRow
                key={p.player_id}
                player={p}
                rank={rankOf.get(p.player_id) ?? 0}
                mode={load.mode}
                matchMinutes={load.match_minutes}
                matchesCount={n}
              />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
