"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Bandage,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  CornerDownLeft,
  Dumbbell,
  HeartPulse,
  House,
  MapPin,
  Search,
  Settings,
  UserCog,
  UserPlus,
  UserRound,
  Users,
  X,
  ChartColumn,
  type LucideIcon,
} from "lucide-react";
import { AvailabilityBadge } from "@/app/ui";
import { searchDestinations, type SearchContext, type SearchDestination } from "@/lib/search-index";
import { highlightParts, MAX_PER_BLOCK, rankBy, searchTokens } from "@/lib/search-match";
import { loadSearchData, type SearchData, type SearchPlayer } from "./actions";
import { revealAnchor } from "./reveal-anchor";

export type SearchLauncherProps = {
  // "dark" sobre la portada; "light" sobre la barra blanca.
  tone?: "light" | "dark";
};

type Row =
  | { kind: "player"; key: string; href: string; player: SearchPlayer }
  | { kind: "dest"; key: string; href: string; dest: SearchDestination };

const ICON_BY_ROOT: Record<string, LucideIcon> = {
  "/dashboard": House,
  "/calendario": CalendarDays,
  "/plantel": Users,
  "/lesiones": Bandage,
  "/registrar-lesion": Bandage,
  "/metricas": ChartColumn,
  "/asistencia": ChartColumn,
  "/nominas": ClipboardList,
  "/evaluaciones": Activity,
  "/planes": Dumbbell,
  "/mi-plan": Dumbbell,
  "/bienestar": HeartPulse,
  "/ausencias": CalendarOff,
  "/staff": UserCog,
  "/registros": UserPlus,
  "/configuracion": Settings,
  "/perfil": UserRound,
};

function destIcon(d: SearchDestination): LucideIcon {
  if (d.id === "zonas") return MapPin;
  if (d.href.startsWith("/calendario/ausencias")) return CalendarOff;
  const root = "/" + d.href.split(/[?#]/)[0].split("/")[1];
  return ICON_BY_ROOT[root] ?? Search;
}

function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-sm bg-brand-line text-inherit">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

// Lupa del encabezado + buscador universal: hoja inferior en celular, paleta centrada
// en escritorio. Ctrl/Cmd+K lo abre en cualquier pantalla.
export function SearchLauncher(props: SearchLauncherProps) {
  const { tone = "light" } = props;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Devuelve el foco a la lupa (si la página cambió, el botón puede ya no existir).
    triggerRef.current?.focus();
  }, []);

  const base =
    tone === "dark"
      ? "bg-white/15 text-white hover:bg-white/25 focus-visible:outline-white"
      : "border border-line bg-white text-ink hover:bg-mist focus-visible:outline-brand-strong";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 lg:h-10 lg:w-auto lg:gap-2 lg:px-3 ${base}`}
      >
        <Search aria-hidden="true" className="size-5 lg:size-4" />
        <span className="hidden text-sm font-medium lg:inline">Buscar</span>
        <kbd
          aria-hidden="true"
          className={`hidden rounded-md px-1.5 py-0.5 font-sans text-[11px] font-medium lg:inline ${
            tone === "dark" ? "bg-white/20 text-white" : "bg-fill-soft text-body"
          }`}
        >
          Ctrl K
        </kbd>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(<SearchDialog onClose={close} />, document.body)}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const titleId = useId();
  const listId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [data, setData] = useState<SearchData | null>(null);
  const [failed, setFailed] = useState(false);

  // Una sola consulta, al abrir (no en el layout): permisos, formato y jugadores.
  useEffect(() => {
    let cancelled = false;
    loadSearchData()
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setData(r.data);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);
  const canSearchPlayers = !!data?.players;
  const players: SearchPlayer[] | null = data?.players ?? null;
  const loading = !data && !failed;

  // Foco en el campo, sin scroll de fondo y la hoja por encima del teclado del celular.
  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const vv = window.visualViewport;
    const update = () => {
      if (!vv || !panelRef.current) return;
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      panelRef.current.style.setProperty("--kb", `${kb}px`);
      panelRef.current.style.setProperty("--vvh", `${vv.height}px`);
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      document.body.style.overflow = prev;
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, []);

  // Destinos solo de celular (Perfil › Barra principal): el mismo corte lg que el resto de la app.
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023.98px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const ctx = useMemo<SearchContext | null>(
    () =>
      data
        ? {
            roles: data.roles,
            permissions: data.permissions,
            staff: data.staff,
            evaluations: data.evaluations,
            sport: data.sport,
            hasSevens: data.hasSevens,
            mobile,
          }
        : null,
    [data, mobile],
  );

  const trimmed = query.trim();
  const hasQuery = searchTokens(query).length > 0;
  const playerRows: Row[] = useMemo(() => {
    if (!hasQuery || !players) return [];
    return rankBy(players, query, (p) => ({ title: p.name }), MAX_PER_BLOCK).map((p) => ({
      kind: "player" as const,
      key: `p-${p.id}`,
      href: `/jugadores/${p.id}`,
      player: p,
    }));
  }, [hasQuery, players, query]);
  const destRows: Row[] = useMemo(
    () =>
      hasQuery && ctx
        ? searchDestinations(query, ctx, MAX_PER_BLOCK).map((d) => ({
            kind: "dest" as const,
            key: `d-${d.id}`,
            href: d.href,
            dest: d,
          }))
        : [],
    [hasQuery, query, ctx],
  );
  const rows = useMemo(() => [...playerRows, ...destRows], [playerRows, destRows]);
  const selected = Math.min(active, Math.max(rows.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected, rows.length]);

  const go = useCallback(
    (row: Row) => {
      onClose();
      router.push(row.href);
      const hash = row.href.split("#")[1];
      if (hash) revealAnchor(hash);
    },
    [onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (rows.length === 0) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((selected + step + rows.length) % rows.length);
    } else if (e.key === "Enter" && e.target === inputRef.current && rows[selected]) {
      e.preventDefault();
      go(rows[selected]);
    } else if (e.key === "Tab") {
      // Foco atrapado dentro del buscador.
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const clear = () => {
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  };

  const renderRow = (row: Row, i: number) => {
    const isSel = i === selected;
    return (
      <button
        key={row.key}
        type="button"
        role="option"
        id={`${listId}-${i}`}
        data-row={i}
        aria-selected={isSel}
        tabIndex={-1}
        onClick={() => go(row)}
        onMouseMove={() => setActive(i)}
        className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-3 py-2 text-left ring-2 transition-colors ${
          isSel ? "bg-brand-wash ring-brand-line lg:ring-brand" : "ring-transparent"
        }`}
      >
        {row.kind === "player" ? (
          <>
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-sm font-medium text-brand-text">
              {row.player.avatarUrl ? (
                // Foto privada por /foto: no pasa por next/image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.player.avatarUrl} alt="" width={44} height={44} className="size-full object-cover" />
              ) : (
                <span aria-hidden="true">{initials(row.player.name)}</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-brand-night">
                <Highlight text={row.player.name} query={query} />
              </span>
              <span className="block truncate text-sm text-body">{row.player.position ?? "Sin posición"}</span>
            </span>
            <AvailabilityBadge status={row.player.availability} />
          </>
        ) : (
          <>
            {(() => {
              const Icon = destIcon(row.dest);
              return (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
              );
            })()}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-brand-night">
                <Highlight text={row.dest.title} query={query} />
              </span>
              <span className="block truncate text-sm text-body">{row.dest.context}</span>
            </span>
          </>
        )}
        {isSel ? (
          <span className="hidden shrink-0 items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-xs font-medium text-brand-text ring-1 ring-brand-line lg:inline-flex">
            Enter
            <CornerDownLeft aria-hidden="true" className="size-3" />
          </span>
        ) : null}
        {row.kind === "dest" && (
          <ArrowRight
            aria-hidden="true"
            className={`size-5 shrink-0 text-brand-text ${isSel ? "lg:hidden" : ""}`}
          />
        )}
      </button>
    );
  };

  const labelClass = "px-3 pt-3 pb-1 font-display text-[13px] font-semibold tracking-wide text-body uppercase";

  return (
    <div className="fixed inset-0 z-[60]" onKeyDown={onKeyDown}>
      <div
        aria-hidden="true"
        className="search-backdrop absolute inset-0 bg-brand-night/50"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="search-panel absolute inset-x-0 bottom-[var(--kb,0px)] flex max-h-[calc(var(--vvh,100dvh)-1rem)] flex-col rounded-t-3xl bg-white shadow-2xl lg:inset-x-auto lg:top-24 lg:bottom-auto lg:left-1/2 lg:max-h-[min(640px,calc(100dvh-8rem))] lg:w-[760px] lg:max-w-[calc(100vw-2rem)] lg:-translate-x-1/2 lg:rounded-2xl"
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line-strong lg:hidden" />
        <h2 id={titleId} className="sr-only">
          Buscar jugadores y secciones
        </h2>
        <div className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-2 lg:px-5 lg:pt-5">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-brand-text" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={rows.length > 0}
              aria-controls={listId}
              aria-activedescendant={rows.length > 0 ? `${listId}-${selected}` : undefined}
              aria-autocomplete="list"
              aria-label="Buscar"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="Buscar jugador o sección"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              // 16 px: evita el zoom de iOS al enfocar el campo.
              className="h-[52px] w-full rounded-2xl bg-fill-faint pr-12 pl-12 text-base text-brand-night ring-2 ring-brand outline-none placeholder:text-placeholder"
            />
            {query && (
              <button
                type="button"
                onClick={clear}
                aria-label="Borrar búsqueda"
                className="absolute top-1/2 right-2.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-line-soft text-body-strong hover:bg-line-strong focus-visible:outline-2 focus-visible:outline-brand-text"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-brand-text hover:bg-brand-wash focus-visible:outline-2 focus-visible:outline-brand-text lg:hidden"
          >
            Cerrar
          </button>
        </div>

        {data && canSearchPlayers && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-2 lg:px-5">
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-deep">{data?.scopeLabel}</span>
            <span className="text-sm text-body">Buscas entre los jugadores de este formato</span>
          </div>
        )}

        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Resultados"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 lg:px-3"
        >
          {!hasQuery ? (
            <p className="px-3 py-8 text-center text-sm text-body">Escribe un nombre o una sección</p>
          ) : rows.length === 0 && loading ? (
            <p className="px-3 py-8 text-center text-sm text-body" role="status">
              Buscando…
            </p>
          ) : rows.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-brand-night">Sin resultados para “{trimmed}”</p>
              <button
                type="button"
                onClick={clear}
                className="mt-3 min-h-11 rounded-xl px-4 text-sm font-semibold text-brand-text hover:bg-brand-wash focus-visible:outline-2 focus-visible:outline-brand-text"
              >
                Borrar búsqueda
              </button>
            </div>
          ) : (
            <>
              {playerRows.length > 0 && (
                <div role="group" aria-labelledby={`${listId}-jug`}>
                  <p id={`${listId}-jug`} className={labelClass}>
                    Jugadores
                  </p>
                  {playerRows.map((r, i) => renderRow(r, i))}
                </div>
              )}
              {destRows.length > 0 && (
                <div role="group" aria-labelledby={`${listId}-ir`}>
                  <p id={`${listId}-ir`} className={labelClass}>
                    Ir a
                  </p>
                  {destRows.map((r, i) => renderRow(r, playerRows.length + i))}
                </div>
              )}
              {loading && (
                <p className="px-3 py-2 text-sm text-body" role="status">
                  Cargando…
                </p>
              )}
            </>
          )}
          {hasQuery && failed && (
            <p className="px-3 py-2 text-sm text-body" role="status">
              No se pudo cargar el buscador. Intenta de nuevo.
            </p>
          )}
        </div>

        <div className="hidden shrink-0 items-center gap-4 border-t border-line-soft px-5 py-3 text-xs text-body lg:flex">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded-md bg-fill-soft px-1.5 py-0.5 font-sans font-medium">↑ ↓</kbd> Navegar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded-md bg-fill-soft px-1.5 py-0.5 font-sans font-medium">Enter</kbd> Abrir
          </span>
          <span className="ml-auto">Solo ves lo que tu rol permite</span>
        </div>
      </div>
    </div>
  );
}
