"use client";

import { useActionState, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, Plus, Save, Sparkles, Undo2 } from "lucide-react";
import { formatValue, parseValue, type TestDefinition } from "@/lib/evaluations";
import {
  ErrorMessage,
  SuccessMessage,
  buttonPrimary,
  buttonSecondary,
  inputClass,
  labelClass,
  optionalClass,
  textButton,
} from "@/app/ui";
import {
  addSuggestedTests,
  archiveTest,
  createTest,
  recordResults,
  voidResult,
  type EvalState,
} from "./actions";

// Cambia un parámetro de la URL (test, fecha) y vuelve a pedir la página.
function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    next.delete("guardado");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
}

export function TestPicker({ tests, selectedId }: { tests: TestDefinition[]; selectedId: string }) {
  const setParam = useSetParam();
  return (
    <label className={`min-w-0 flex-1 ${labelClass}`}>
      Test
      <select value={selectedId} onChange={(e) => setParam("test", e.target.value)} className={inputClass}>
        {tests.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.display_format === "mmss" ? "mm:ss" : t.unit}
            {t.higher_is_better ? "" : ", menos es mejor"})
          </option>
        ))}
      </select>
    </label>
  );
}

export function DatePicker({ value, max }: { value: string; max: string }) {
  const setParam = useSetParam();
  return (
    <label className={`w-full sm:w-48 ${labelClass}`}>
      Fecha
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => e.target.value && setParam("fecha", e.target.value)}
        className={inputClass}
      />
    </label>
  );
}

export type LoadRow = {
  playerId: string;
  name: string;
  position: string | null;
  previous: { value: number; measured_on: string } | null;
  // Resultado ya guardado en esa fecha (se anula para volver a cargarlo).
  sameDay: { id: string; value: number } | null;
};

// Lista del plantel con un campo por jugador. "Guardar N resultados" guarda todo junto.
export function ResultsForm({
  test,
  date,
  rows,
  savedCount,
}: {
  test: TestDefinition;
  date: string;
  rows: LoadRow[];
  savedCount: number | null;
}) {
  const [state, formAction, pending] = useActionState<EvalState, FormData>(recordResults, {});
  const [values, setValues] = useState<Record<string, string>>({});
  // Solo cuentan los campos visibles: tras guardar, esas filas pasan a "ya guardado".
  const open = rows.filter((r) => !r.sameDay && values[r.playerId]?.trim());
  const filled = open.length;
  const invalid = open.filter((r) => parseValue(values[r.playerId], test.display_format) === null).map((r) => r.playerId);
  const [voiding, startVoid] = useTransition();
  const [voidError, setVoidError] = useState<string | null>(null);
  const placeholder = test.display_format === "mmss" ? "m:ss" : test.unit;
  const saved = state.saved ?? savedCount;

  return (
    <form
      action={formAction}
      className="space-y-4"
    >
      <input type="hidden" name="test_id" value={test.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="format" value={test.display_format} />
      {saved ? <SuccessMessage>Guardamos {saved} {saved === 1 ? "resultado" : "resultados"}.</SuccessMessage> : null}
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-mist">
        {rows.map((r) => {
          const bad = invalid.includes(r.playerId);
          return (
            <li key={r.playerId} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{r.name}</p>
                <p className="truncate text-xs text-muted">
                  {r.position ?? "Sin posición"}
                  {" · "}
                  {r.previous
                    ? `Anterior: ${formatValue(r.previous.value, test)}`
                    : "Sin evaluación anterior"}
                </p>
              </div>
              {r.sameDay ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-ink tabular-nums">{formatValue(r.sameDay.value, test)}</span>
                  <button
                    type="button"
                    disabled={voiding}
                    onClick={() =>
                      startVoid(async () => {
                        setVoidError(null);
                        const res = await voidResult(r.sameDay!.id);
                        if (res.error) setVoidError(res.error);
                        // El campo vuelve vacío para cargar el valor correcto.
                        else setValues((v) => ({ ...v, [r.playerId]: "" }));
                      })
                    }
                    className={`${textButton} gap-1`}
                    aria-label={`Anula el resultado de ${r.name}`}
                  >
                    <Undo2 aria-hidden="true" className="size-4" />
                    Anula
                  </button>
                </div>
              ) : (
                <label className="w-28 shrink-0">
                  <span className="sr-only">Resultado de {r.name}</span>
                  <input
                    name={`v:${r.playerId}`}
                    inputMode={test.display_format === "mmss" ? "numeric" : "decimal"}
                    autoComplete="off"
                    placeholder={placeholder}
                    value={values[r.playerId] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [r.playerId]: e.target.value }))}
                    aria-invalid={bad || undefined}
                    className={`min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-right text-ink tabular-nums outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-soft ${
                      bad ? "border-lesionado-fg" : "border-line"
                    }`}
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {voidError && <ErrorMessage>{voidError}</ErrorMessage>}
      {invalid.length > 0 && (
        <ErrorMessage>
          {test.display_format === "mmss"
            ? "Hay tiempos que no se entienden: escríbelos como minutos y segundos, por ejemplo 4:35."
            : "Hay valores que no se entienden: usa solo números mayores que 0, por ejemplo 102,5."}
        </ErrorMessage>
      )}
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {/* Fijo abajo en celular para no tener que bajar hasta el final de la lista. */}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-4">
        <button
          type="submit"
          disabled={pending || filled === 0 || invalid.length > 0}
          className={`w-full shadow-sm ${buttonPrimary}`}
        >
          <Save aria-hidden="true" className="size-4" />
          {pending ? "Guardando…" : filled === 0 ? "Anota al menos un resultado" : `Guardar ${filled} ${filled === 1 ? "resultado" : "resultados"}`}
        </button>
      </div>
    </form>
  );
}

// Catálogo vacío: copia los tests sugeridos al plantel.
export function SuggestedTestsButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await addSuggestedTests();
            setError(res.error ?? null);
          })
        }
        className={buttonPrimary}
      >
        <Sparkles aria-hidden="true" className="size-4" />
        {pending ? "Agregando…" : "Agregar tests sugeridos"}
      </button>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}

// Crear tests propios y archivar los que ya no se usan.
export function CatalogManager({ tests }: { tests: TestDefinition[] }) {
  const [state, formAction, pending] = useActionState<EvalState, FormData>(createTest, {});
  const [format, setFormat] = useState<"number" | "mmss">("number");
  const [archiving, startArchive] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  return (
    <div className="space-y-5">
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
        {tests.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <span className="text-sm text-ink">
              {t.name}{" "}
              <span className="text-muted">
                ({t.display_format === "mmss" ? "mm:ss" : t.unit}, {t.higher_is_better ? "más es mejor" : "menos es mejor"})
              </span>
            </span>
            {confirm === t.id ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={archiving}
                  onClick={() =>
                    startArchive(async () => {
                      const res = await archiveTest(t.id);
                      setArchiveError(res.error ?? null);
                      setConfirm(null);
                    })
                  }
                  className={`text-sm ${buttonSecondary}`}
                >
                  Sí, archiva
                </button>
                <button type="button" onClick={() => setConfirm(null)} className={textButton}>
                  Cancelar
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirm(t.id)} className={`${textButton} gap-1`}>
                <Archive aria-hidden="true" className="size-4" />
                Archiva
              </button>
            )}
          </li>
        ))}
      </ul>
      {archiveError && <ErrorMessage>{archiveError}</ErrorMessage>}
      <p className="text-xs text-muted">Archivar oculta el test para nuevas cargas; sus resultados se conservan.</p>

      <form action={formAction} className="space-y-3">
        <p className="text-sm font-medium text-ink">Crea un test propio</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Nombre
            <input name="name" required minLength={2} maxLength={60} placeholder="Ej.: Salto largo" className={inputClass} />
          </label>
          <label className={labelClass}>
            Cómo se anota
            <select name="format" value={format} onChange={(e) => setFormat(e.target.value as "number" | "mmss")} className={inputClass}>
              <option value="number">Número con unidad</option>
              <option value="mmss">Tiempo en minutos y segundos (mm:ss)</option>
            </select>
          </label>
          {format === "number" && (
            <label className={labelClass}>
              Unidad
              <input name="unit" required maxLength={12} placeholder="kg, cm, s, m…" className={inputClass} />
            </label>
          )}
          <label className={labelClass}>
            Mejor resultado
            <select name="better" defaultValue="mas" className={inputClass}>
              <option value="mas">Más alto es mejor</option>
              <option value="menos">Más bajo es mejor (tiempos)</option>
            </select>
          </label>
        </div>
        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
        {state.ok && <SuccessMessage>Test creado.</SuccessMessage>}
        <button type="submit" disabled={pending} className={buttonSecondary}>
          <Plus aria-hidden="true" className="size-4" />
          {pending ? "Creando…" : "Crea el test"}
        </button>
        <p className={`text-xs ${optionalClass}`}>Los tests son del plantel: los ve todo el staff.</p>
      </form>
    </div>
  );
}
