"use client";

import Image from "next/image";
import { useState } from "react";
import type { Feature } from "@/lib/landing/config";

// Funciones por rol: la lista a la izquierda y, a la derecha, un celular con la captura elegida.
export function Features({ staff, players }: { staff: Feature[]; players: Feature[] }) {
  const [role, setRole] = useState<"staff" | "jugadores">("staff");
  const [sel, setSel] = useState(0);
  const list = role === "staff" ? staff : players;
  const current = list[Math.min(sel, list.length - 1)];

  return (
    <>
      <p className="lp-kicker lp-label">✳ Funciones</p>
      <div className="lp-features-head">
        <h2 id="funciones-title" className="lp-display lp-h2">Todo tu club.<br />En un solo lugar.</h2>
        <div role="group" aria-label="Ver funciones para" className="lp-toggle">
          {(["staff", "jugadores"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => {
                setRole(r);
                setSel(0);
              }}
            >
              {r === "staff" ? "Staff" : "Jugadores"}
            </button>
          ))}
        </div>
      </div>
      <div className="lp-fx">
        <ul className="lp-fx-list" aria-label={role === "staff" ? "Funciones para el staff" : "Funciones para jugadores"}>
          {list.map((f, i) => (
            <li key={f.file}>
              <button type="button" className="lp-fx-item" aria-pressed={f === current} aria-controls="lp-fx-shot" onClick={() => setSel(i)}>
                <span className="lp-display lp-fx-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <span className="lp-fx-text">
                  <span className="lp-fx-title">{f.title}</span>
                  <span className="lp-fx-desc">{f.desc}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="lp-phone" id="lp-fx-shot" aria-live="polite">
          <div className="lp-phone-screen">
            <Image key={current.file} src={`/landing/${current.file}.webp`} alt={current.alt} fill sizes="316px" />
          </div>
        </div>
      </div>
    </>
  );
}
