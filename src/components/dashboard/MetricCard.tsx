import type { LucideIcon } from "lucide-react";
import { Card } from "../common/Card";

type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
};

export function MetricCard({ label, value, hint, icon: Icon }: MetricCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-nebula-muted">{label}</p>
          <p className="mt-3 text-2xl font-semibold text-nebula-text">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}
