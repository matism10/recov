"use client";

import {
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { resizeCover } from "@/app/avatar-resize";
import { COVER_GRADIENT } from "@/lib/club-identity";
import { ErrorMessage, SuccessMessage, buttonPrimary, textButton } from "@/app/ui";
import { setClubCover, setClubCoverPosition, type CoverState } from "./actions";

type Position = { x: number; y: number };
const CENTER: Position = { x: 50, y: 50 };

// Proporciones del encabezado real (ClubHeader): en computador ~1200 × 128 (ancho de
// la ventana menos la sidebar) y en celular 390 × 96. Cada una recorta distinto.
const FRAMES = [
  { key: "computador", label: "Computador", className: "aspect-[1200/128] w-full" },
  { key: "celular", label: "Celular", className: "aspect-[390/96] w-full max-w-[390px]" },
] as const;

const clamp = (n: number) => Math.min(100, Math.max(0, n));

// Portada: se achica en el navegador, se sube directo a Storage (carpeta del club,
// bucket privado) y set_club_cover la deja en el club, centrada. Después se encuadra
// arrastrando la foto (o con las flechas) y set_club_cover_position guarda el encuadre.
export function CoverForm({
  clubName,
  url,
  position,
  folder,
}: {
  clubName: string;
  url: string | null;
  position: Position;
  folder: string;
}) {
  const [preview, setPreview] = useState<string | null>(url);
  const [pos, setPos] = useState<Position>(position);
  const [saved, setSaved] = useState<Position>(position);
  const [state, setState] = useState<CoverState>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const drag = useRef<{
    id: number;
    startX: number;
    startY: number;
    from: Position;
    overflowX: number;
    overflowY: number;
  } | null>(null);

  const dirty = pos.x !== saved.x || pos.y !== saved.y;

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    startTransition(async () => {
      setState({});
      let blob: Blob;
      try {
        blob = await resizeCover(file);
      } catch {
        setState({ error: "No pudimos leer esa imagen. Prueba con un JPG o PNG." });
        return;
      }
      const path = `${folder}/${crypto.randomUUID()}.jpg`;
      const { error } = await createClient()
        .storage.from("club-covers")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) {
        setState({ error: "No se pudo subir la portada. Intenta de nuevo." });
        return;
      }
      const result = await setClubCover(path);
      if (result.ok) {
        setPreview(URL.createObjectURL(blob));
        setPos(CENTER);
        setSaved(CENTER);
        setMessage("Portada guardada. Arrástrala para encuadrarla.");
      }
      setState(result);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await setClubCover(null);
      if (result.ok) {
        setPreview(null);
        setPos(CENTER);
        setSaved(CENTER);
        setMessage("Portada quitada.");
      }
      setState(result);
    });
  }

  function saveFraming() {
    startTransition(async () => {
      const result = await setClubCoverPosition(pos.x, pos.y);
      if (result.ok) {
        setSaved(pos);
        setMessage("Encuadre guardado.");
      }
      setState(result);
    });
  }

  // Arrastrar mueve la foto con el dedo o el mouse: se convierte el desplazamiento
  // en píxeles a porcentaje de lo que sobra de la foto en ese recuadro.
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const img = e.currentTarget.querySelector("img");
    if (!img || !img.naturalWidth) return;
    const frame = e.currentTarget.getBoundingClientRect();
    const scale = Math.max(frame.width / img.naturalWidth, frame.height / img.naturalHeight);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      from: pos,
      overflowX: img.naturalWidth * scale - frame.width,
      overflowY: img.naturalHeight * scale - frame.height,
    };
    setState({});
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setPos({
      x: d.overflowX > 0 ? clamp(Math.round(d.from.x - (dx / d.overflowX) * 100)) : d.from.x,
      y: d.overflowY > 0 ? clamp(Math.round(d.from.y - (dy / d.overflowY) * 100)) : d.from.y,
    });
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  // Flechas: mueven la foto 2 % (10 % con Mayús), en el mismo sentido que arrastrar.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, Position> = {
      ArrowLeft: { x: pos.x + step, y: pos.y },
      ArrowRight: { x: pos.x - step, y: pos.y },
      ArrowUp: { x: pos.x, y: pos.y + step },
      ArrowDown: { x: pos.x, y: pos.y - step },
    };
    const next = moves[e.key];
    if (!next) return;
    e.preventDefault();
    setState({});
    setPos({ x: clamp(next.x), y: clamp(next.y) });
  }

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="space-y-3">
          {FRAMES.map((frame) => (
            <div key={frame.key}>
              <p className="mb-1 text-xs font-medium text-muted">{frame.label}</p>
              <div
                role="group"
                tabIndex={0}
                aria-label={`Encuadre de la portada en ${frame.label.toLowerCase()}: arrastra la foto o usa las flechas`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onKeyDown}
                className={`relative cursor-grab touch-none overflow-hidden rounded-xl bg-ink outline-none select-none focus-visible:ring-2 focus-visible:ring-brand active:cursor-grabbing ${frame.className}`}
              >
                {/* Vista previa (URL firmada o local): no pasa por next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt={`Portada de ${clubName}`}
                  draggable={false}
                  className="pointer-events-none h-full w-full object-cover"
                  style={{ objectPosition: `${pos.x}% ${pos.y}%` }}
                />
                {/* Mismo degradado que el encabezado, para ver cómo se lee el nombre. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{ background: COVER_GRADIENT[frame.key] }}
                />
                <p
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-2 left-3 truncate font-display text-sm font-bold text-white"
                >
                  {clubName}
                </p>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={saveFraming}
              disabled={pending || !dirty}
              className={buttonPrimary}
            >
              Guarda el encuadre
            </button>
            {dirty && (
              <button
                type="button"
                onClick={() => setPos(saved)}
                disabled={pending}
                className={textButton}
              >
                Deshaz los cambios
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex aspect-[1200/128] min-h-16 w-full items-center justify-center rounded-xl border border-line bg-surface-2">
          <p className="text-sm text-muted">Sin portada</p>
        </div>
      )}
      <div className="flex flex-wrap gap-x-4">
        <label className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand-text underline">
          {preview ? "Cambia la portada" : "Sube una portada"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={pick}
            disabled={pending}
            className="sr-only"
          />
        </label>
        {preview && (
          <button type="button" onClick={remove} disabled={pending} className={textButton}>
            Quita la portada
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        JPG, PNG o WebP, idealmente horizontal. Se ajusta a 1600 px. La ven solo los
        miembros confirmados del plantel.
      </p>
      {pending && <p className="text-sm text-muted">Guardando…</p>}
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {state.ok && !pending && message && <SuccessMessage>{message}</SuccessMessage>}
    </div>
  );
}
