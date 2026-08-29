import { BUSINESS_PHASES } from "@/lib/business-os";
import { Badge } from "@/components/ui/Badge";

export function BusinessPhaseBar({ current = 1 }: { current?: number }) {
  return (
    <div className="rounded-lg border border-hairline bg-panel p-4 shadow-float">
      <div className="flex flex-wrap gap-2">
        {BUSINESS_PHASES.map((phase) => (
          <div key={phase.id} className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${phase.id <= current ? "bg-signal text-white" : "bg-surface text-slate"}`}>{phase.id}</span>
            <span className="text-sm font-semibold text-ink">{phase.name}</span>
            {phase.id < current && <Badge tone="pulse">Done</Badge>}
          </div>
        ))}
      </div>
    </div>
  );
}
