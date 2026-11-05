"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { WEEKDAYS } from "@/lib/srpe";
import { SectionTitle } from "@/app/ui";
import type { WeekData } from "./week-data";

const LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

// "Mi semana": fila de 7 días (L a D) con G (gimnasio), E (entrenamiento) o P (partido);
// "·" si no hay nada y las letras juntas si hay más de una. Hoy va en #082F49. Al tocar
// un día se ve qué hay.
export function MyWeek({ data }: { data: WeekData }) {
  const [selected, setSelected] = useState(data.today);
  const day = data.days.find((d) => d.date === selected) ?? data.days[0];

  return (
    <section className="mb-8" aria-labelledby="mi-semana-title">
      <SectionTitle className="mb-3">
        <span id="mi-semana-title">Mi semana</span>
      </SectionTitle>
      <div className="rounded-xl border border-line bg-white p-3 sm:p-4">
        <div role="tablist" aria-label="Días de la semana" className="grid grid-cols-7 gap-1.5">
          {data.days.map((d, i) => {
            const today = d.date === data.today;
            const on = d.date === day.date;
            const tag = [...new Set(d.items.map((x) => x.kind))].join("") || "·";
            return (
              <button
                key={d.date}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={`${WEEKDAYS[i].label}${today ? " (hoy)" : ""}: ${
                  d.items.length === 0 ? "sin actividades" : d.items.map((x) => x.title).join(", ")
                }`}
                onClick={() => setSelected(d.date)}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-sm transition ${
                  today
                    ? "bg-[#082F49] text-white"
                    : d.items.length > 0
                      ? "bg-[#F1F5F9] text-ink"
                      : "border border-[#F1F5F9] bg-white text-muted"
                } ${on && !today ? "ring-2 ring-brand" : ""} ${on && today ? "ring-2 ring-brand ring-offset-2" : ""}`}
              >
                <span aria-hidden="true" className="text-[11px] font-medium opacity-80">
                  {LETTERS[i]}
                </span>
                <span aria-hidden="true" className="font-display font-bold tracking-wide">
                  {tag}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-muted">G = gimnasio · E = entrenamiento · P = partido</p>

        <div role="tabpanel" aria-live="polite" className="mt-3 border-t border-line pt-3">
          <p className="mb-1 text-sm font-medium text-ink">
            {WEEKDAYS[data.days.indexOf(day)].label}
            {day.date === data.today && " · hoy"}
          </p>
          {day.items.length === 0 ? (
            <p className="text-sm text-muted">Nada programado.</p>
          ) : (
            <ul className="divide-y divide-line">
              {day.items.map((x, i) => {
                const body = (
                  <>
                    <span
                      aria-hidden="true"
                      className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        x.kind === "G" ? "bg-[#0369A1] text-white" : x.kind === "P" ? "bg-alerta-bg text-alerta-fg" : "bg-brand-soft text-brand-text"
                      }`}
                    >
                      {x.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{x.title}</span>
                      {x.detail && <span className="block text-xs text-muted">{x.detail}</span>}
                    </span>
                    {x.href && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />}
                  </>
                );
                return (
                  <li key={i}>
                    {x.href ? (
                      <Link href={x.href} className="flex min-h-11 items-center gap-3 py-1.5 hover:bg-mist">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex min-h-11 items-center gap-3 py-1.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
