"use client";

import { useState } from "react";
import { PHONE_SIZE, PLAYER_SCREENS, STAFF_SCREENS } from "@/lib/landing/config";
import { Shot } from "./frame";

export function Screens({ images }: { images: Record<string, string | null> }) {
  const [tab, setTab] = useState<"staff" | "jugadores">("staff");
  const items = tab === "staff" ? STAFF_SCREENS : PLAYER_SCREENS;
  return (
    <div>
      <div role="tablist" aria-label="Quién usa Recov" className="inline-flex rounded-full bg-[#E8F6FE] p-1">
        {(["staff", "jugadores"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls="panel-pantallas"
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const n = tab === "staff" ? "jugadores" : "staff";
                setTab(n);
                document.getElementById(`tab-${n}`)?.focus();
              }
            }}
            className={`min-h-11 rounded-full px-6 font-bold transition ${tab === t ? "bg-[#0B1B2B] text-white" : "text-[#0B1B2B]"}`}
          >
            {t === "staff" ? "Staff" : "Jugadores"}
          </button>
        ))}
      </div>
      <ul
        role="tabpanel"
        id="panel-pantallas"
        aria-labelledby={`tab-${tab}`}
        className="-mx-6 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4"
      >
        {items.map((s) => (
          <li key={s.file} className="w-[292px] shrink-0 snap-start rounded-[28px] bg-[#E8F6FE] p-5">
            <p className="text-xs font-bold tracking-wider text-[#3F5266] uppercase">{s.label}</p>
            <p className="mt-2 min-h-[3.5rem] font-[family-name:var(--l-title)] text-lg leading-snug font-bold tracking-tight">{s.text}</p>
            <div className="mx-auto mt-4 h-[300px] w-[200px] overflow-hidden rounded-t-[26px] border-[3px] border-b-0 border-[#0B1B2B] bg-white">
              <Shot src={images[s.file]} name={s.label} width={PHONE_SIZE.width} height={PHONE_SIZE.height} sizes="200px" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
