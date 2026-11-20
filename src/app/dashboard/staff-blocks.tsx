// Bloques del Resumen del staff (PR 3 del rediseño): "Por revisar", "Lesiones activas" y
// la tarjeta "Plantel completo". Solo presentación: los datos los arma page.tsx.
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Users } from "lucide-react";
import { AvailabilityBadge, SectionTitle, StatusBadge, chipClass } from "@/app/ui";
import { Card, EmptyState, PlayerCard, PlayerCardList } from "@/app/ui-blocks";
import { formatDate, recoveryProgress, returnLabel } from "@/lib/injuries";
import { zoneLabel } from "@/lib/body-zones";
import type { Availability } from "@/lib/roles";
import type { BodyMark } from "@/app/body-map";

// Máximo de tarjetas por lista en el Resumen; el resto está en /lesiones.
export const SUMMARY_MAX = 5;

export type ReviewItem = {
  id: string;
  status: string;
  type: string;
  startedOn: string;
  mark: BodyMark | null;
  playerName: string | null;
  photoUrl: string | null;
  hasDocument: boolean;
};

export type ActiveItem = {
  playerId: string;
  name: string;
  photoUrl: string | null;
  availability: Availability;
  href: string;
  injuryType: string | null;
  startedOn: string | null;
  expectedReturnOn: string | null;
};

function SectionHead({ title, count, children }: { title: string; count?: number; children?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <SectionTitle>
        {title}
        {count !== undefined && count > 0 && <span className={`ml-2 align-middle ${chipClass}`}>{count}</span>}
      </SectionTitle>
      {children}
    </div>
  );
}

function SeeAll({ total }: { total: number }) {
  if (total <= SUMMARY_MAX) return null;
  return (
    <Link
      href="/lesiones"
      className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline"
    >
      Ver las {total}
    </Link>
  );
}

export function ReviewSection({ items, className = "" }: { items: ReviewItem[]; className?: string }) {
  const toReview = items.filter((i) => i.status === "activa");
  const awaiting = items.filter((i) => i.status === "en_evaluacion");
  // Primero los diagnósticos por revisar; el tope es del total.
  const shown = [...toReview, ...awaiting].slice(0, SUMMARY_MAX);
  const groups = [
    { title: "Diagnóstico por revisar", all: toReview, list: shown.filter((i) => i.status === "activa"), badge: "Revisar" },
    { title: "Esperando el diagnóstico del jugador", all: awaiting, list: shown.filter((i) => i.status === "en_evaluacion"), badge: "Esperando" },
  ].filter((g) => g.list.length > 0);
  // Los títulos de grupo solo si hay de ambos tipos.
  const both = toReview.length > 0 && awaiting.length > 0;

  return (
    <section id="por-revisar" className={`scroll-mt-4 ${className}`}>
      <SectionHead title="Por revisar" count={items.length} />
      {items.length === 0 ? (
        <EmptyState title="No hay lesiones por revisar." />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.title}>
              {both && (
                <h3 className="mb-2 text-13 font-medium text-muted">
                  {g.title} ({g.all.length})
                </h3>
              )}
              <PlayerCardList>
                {g.list.map((i) => {
                  const title = i.mark ? zoneLabel(i.mark.zone, i.mark.laterality) : i.type;
                  return (
                    <PlayerCard
                      key={i.id}
                      href={`/lesiones/${i.id}`}
                      name={i.playerName ?? title}
                      photoUrl={i.photoUrl}
                      secondary={
                        <>
                          {i.playerName ? `${title} · ` : ""}Desde el {formatDate(i.startedOn)}
                          {!i.hasDocument && <span className="text-alerta-fg"> · Sin documento</span>}
                        </>
                      }
                      badge={
                        <StatusBadge className={g.badge === "Revisar" ? "bg-revision-bg text-revision-fg" : "bg-mist text-muted"}>
                          {g.badge}
                        </StatusBadge>
                      }
                    />
                  );
                })}
              </PlayerCardList>
            </div>
          ))}
          <SeeAll total={items.length} />
        </div>
      )}
    </section>
  );
}

export function ActiveInjuriesSection({ items, className = "" }: { items: ActiveItem[]; className?: string }) {
  // Por fecha de regreso: las de hoy o vencidas primero; sin fecha al final.
  const sorted = [...items].sort((a, b) => {
    if (!a.expectedReturnOn) return b.expectedReturnOn ? 1 : 0;
    if (!b.expectedReturnOn) return -1;
    return a.expectedReturnOn.localeCompare(b.expectedReturnOn);
  });
  return (
    <section id="lesiones-activas" className={`scroll-mt-4 ${className}`}>
      <SectionHead title="Lesiones activas" count={items.length} />
      {items.length === 0 ? (
        <EmptyState title="No hay jugadores lesionados ni en reintegro." />
      ) : (
        <>
          <PlayerCardList>
            {sorted.slice(0, SUMMARY_MAX).map((p) => (
              <PlayerCard
                key={p.playerId}
                href={p.href}
                name={p.name}
                photoUrl={p.photoUrl}
                secondary={[p.injuryType, returnLabel(p.expectedReturnOn)].filter(Boolean).join(" · ")}
                progress={
                  p.startedOn && p.expectedReturnOn
                    ? recoveryProgress(p.startedOn, p.expectedReturnOn).percent
                    : undefined
                }
                progressLabel="Avance hacia el alta"
                badge={<AvailabilityBadge status={p.availability} />}
              />
            ))}
          </PlayerCardList>
          <SeeAll total={items.length} />
        </>
      )}
    </section>
  );
}

export function SquadLink({ count, className = "" }: { count: number; className?: string }) {
  return (
    <Link href="/plantel" className={`block ${className}`}>
      <Card className="flex min-h-14 items-center gap-3 transition hover:bg-mist">
        <Users aria-hidden="true" className="size-5 shrink-0 text-brand-strong" />
        <span className="min-w-0 flex-1 text-15 font-semibold text-ink">
          Plantel completo · {count} {count === 1 ? "jugador" : "jugadores"}
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted" />
      </Card>
    </Link>
  );
}
