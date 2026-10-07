import { recoveryProgress } from "@/lib/injuries";

export function InjuryProgress({
  startedOn,
  expectedReturnOn,
}: {
  startedOn: string;
  expectedReturnOn: string | null;
}) {
  if (!expectedReturnOn) {
    return <p className="text-sm text-slate-500">Sin fecha estimada de alta</p>;
  }

  const { day, total, percent } = recoveryProgress(startedOn, expectedReturnOn);

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>
          Día {day} de {total}
        </span>
        <span>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance hacia el alta"
        className="h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
