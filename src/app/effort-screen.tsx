"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorMessage, PageTitle, textButton } from "@/app/ui";
import { formatLoad } from "@/lib/srpe";
import { EffortPicker } from "@/app/effort-picker";

type Result = { error?: string };

// Pantalla de esfuerzo (sRPE) a la altura del celular: encabezado, el selector de
// número grande al centro y un pie fijo con la carga en vivo, "Guardar" y, si hay,
// el link de "no fui". La comparten /reportar/[eventId] y /mi-plan/esfuerzo/[logId].
// En estas rutas no se muestra la barra inferior (nav-items: HIDE_BAR_ON).
export function EffortScreen({
  backHref,
  backLabel,
  meta,
  title,
  note,
  minutes,
  estimated = false,
  initialRpe,
  onSave,
  absentLabel,
  onAbsent,
  doneHref,
}: {
  backHref: string;
  backLabel: string;
  meta: string;
  title: string;
  note?: string;
  minutes: number;
  estimated?: boolean;
  initialRpe: number | null;
  onSave: (rpe: number) => Promise<Result>;
  absentLabel?: string;
  onAbsent?: () => Promise<Result>;
  doneHref: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<number | null>(initialRpe);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res.error) setError(res.error);
      else router.push(doneHref);
    });

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4">
      <header className="pt-2">
        <Link href={backHref} className={textButton}>
          ← {backLabel}
        </Link>
        <p className="text-[13px] text-muted">{meta}</p>
        <PageTitle className="mt-1">{title}</PageTitle>
        {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      </header>

      <div className="flex flex-1 flex-col justify-center py-4">
        <EffortPicker
          value={picked}
          disabled={pending}
          onChange={(n) => {
            setPicked(n);
            setError(null);
          }}
        />
      </div>

      <footer className="sticky bottom-0 -mx-4 space-y-2.5 border-t border-line bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted">Carga de la sesión</span>
          <span className="font-display text-xl font-extrabold text-ink tabular-nums">
            {picked === null
              ? `? × ${minutes} min`
              : `${picked} × ${minutes} min = ${formatLoad(picked * minutes)}${estimated ? " estimada" : ""}`}
          </span>
        </div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <button
          type="button"
          onClick={() => picked !== null && run(() => onSave(picked))}
          disabled={pending || picked === null}
          className="flex h-13 w-full items-center justify-center rounded-[14px] bg-[#38BDF8] text-base font-semibold text-[#082F49] transition hover:bg-brand-hover active:bg-brand-strong disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {absentLabel && onAbsent && (
          <button
            type="button"
            onClick={() => run(onAbsent)}
            disabled={pending}
            className="flex min-h-11 w-full items-center justify-center text-sm font-medium text-brand-text underline disabled:opacity-60"
          >
            {absentLabel}
          </button>
        )}
      </footer>
    </main>
  );
}
